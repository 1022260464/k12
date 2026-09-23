import asyncio
import json
import logging
from typing import Any

import numpy as np

from k12_agent_runtime.domain.rag import (
    DocumentCandidate,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeSearchQuery,
)
from k12_agent_runtime.infrastructure.rag.errors import RagModelError

logger = logging.getLogger(__name__)


class PgVectorKnowledgeRepository:
    """使用asyncpg访问pgvector；所有查询参数化，不拼接用户输入。"""

    def __init__(self, database_url: str, min_pool_size: int, max_pool_size: int) -> None:
        self._database_url = database_url
        self._min_pool_size = min_pool_size
        self._max_pool_size = max_pool_size
        self._pool: Any | None = None
        self._pool_lock = asyncio.Lock()

    async def replace_document(
        self,
        document: KnowledgeDocument,
        chunks: tuple[KnowledgeChunk, ...],
    ) -> None:
        pool = await self._get_pool()
        try:
            async with pool.acquire() as connection, connection.transaction():
                await connection.execute(
                    """
                    INSERT INTO k12_rag.knowledge_document (
                        document_id, title, source_type, source_uri, content,
                        stage_code, grade, textbook, chapter, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                    ON CONFLICT (document_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        source_type = EXCLUDED.source_type,
                        source_uri = EXCLUDED.source_uri,
                        content = EXCLUDED.content,
                        stage_code = EXCLUDED.stage_code,
                        grade = EXCLUDED.grade,
                        textbook = EXCLUDED.textbook,
                        chapter = EXCLUDED.chapter,
                        metadata = EXCLUDED.metadata,
                        updated_time = CURRENT_TIMESTAMP
                    """,
                    document.document_id,
                    document.title,
                    document.source_type,
                    document.source_uri,
                    document.content,
                    document.stage_code,
                    document.grade,
                    document.textbook,
                    document.chapter,
                    json.dumps(document.metadata, ensure_ascii=False),
                )
                await connection.execute(
                    "DELETE FROM k12_rag.knowledge_chunk WHERE document_id = $1",
                    document.document_id,
                )
                await connection.executemany(
                    """
                    INSERT INTO k12_rag.knowledge_chunk (
                        chunk_id, document_id, chunk_index, title, content,
                        embedding, embedding_model, source_uri, stage_code,
                        grade, textbook, chapter, metadata
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
                    )
                    """,
                    [
                        (
                            chunk.chunk_id,
                            chunk.document_id,
                            chunk.chunk_index,
                            chunk.title,
                            chunk.content,
                            np.asarray(chunk.embedding, dtype=np.float32),
                            chunk.embedding_model,
                            chunk.source_uri,
                            chunk.stage_code,
                            chunk.grade,
                            chunk.textbook,
                            chunk.chapter,
                            json.dumps(chunk.metadata, ensure_ascii=False),
                        )
                        for chunk in chunks
                    ],
                )
        except Exception as exc:  # noqa: BLE001
            logger.exception("写入pgvector知识文档失败：document_id=%s", document.document_id)
            raise RagModelError("knowledge_storage_failed") from exc

    async def search(
        self,
        query: KnowledgeSearchQuery,
    ) -> tuple[DocumentCandidate, ...]:
        pool = await self._get_pool()
        try:
            rows = await pool.fetch(
                """
                WITH filtered AS (
                SELECT
                    chunk_id,
                    document_id,
                    content,
                    embedding,
                    metadata,
                    title,
                    source_uri,
                    stage_code,
                    grade,
                    textbook,
                    chapter
                FROM k12_rag.knowledge_chunk
                WHERE embedding_model = $2
                  AND ($3::text IS NULL OR stage_code = $3)
                  AND ($4::text IS NULL OR grade = $4)
                  AND ($5::text IS NULL OR textbook = $5)
                  AND (
                    cardinality($6::text[]) = 0
                    OR COALESCE(metadata->>'knowledgeCode', '') = ANY($6::text[])
                  )
                ),
                dense_candidates AS (
                    SELECT chunk_id, 1 - (embedding <=> $1) AS dense_score
                    FROM filtered
                    ORDER BY embedding <=> $1
                    LIMIT $9
                ),
                dense_ranked AS (
                    SELECT chunk_id, dense_score,
                           row_number() OVER (ORDER BY dense_score DESC) AS dense_rank
                    FROM dense_candidates
                ),
                lexical_candidates AS (
                    SELECT f.chunk_id,
                           (CASE WHEN position(lower($7) in lower(f.content)) > 0
                                 THEN 3.0 ELSE 0.0 END)
                           + (SELECT count(*)::double precision
                              FROM unnest($8::text[]) AS term
                              WHERE position(lower(term) in lower(f.content)) > 0) AS lexical_score
                    FROM filtered f
                    WHERE $7 <> '' AND (
                        position(lower($7) in lower(f.content)) > 0
                        OR EXISTS (
                            SELECT 1 FROM unnest($8::text[]) AS term
                            WHERE position(lower(term) in lower(f.content)) > 0
                        )
                    )
                    ORDER BY lexical_score DESC, f.chunk_id
                    LIMIT $9
                ),
                lexical_ranked AS (
                    SELECT chunk_id, lexical_score,
                           row_number() OVER (ORDER BY lexical_score DESC, chunk_id) AS lexical_rank
                    FROM lexical_candidates
                ),
                fused AS (
                    SELECT chunk_id,
                           max(dense_score) AS dense_score,
                           max(lexical_score) AS lexical_score,
                           sum(rrf_score) AS rrf_score
                    FROM (
                        SELECT chunk_id, dense_score, NULL::double precision AS lexical_score,
                               1.0 / (60 + dense_rank) AS rrf_score
                        FROM dense_ranked
                        UNION ALL
                        SELECT chunk_id, NULL::double precision, lexical_score,
                               1.0 / (60 + lexical_rank) AS rrf_score
                        FROM lexical_ranked
                    ) ranked
                    GROUP BY chunk_id
                )
                SELECT f.chunk_id, f.document_id, f.content, f.metadata, f.title,
                       f.source_uri, f.stage_code, f.grade, f.textbook, f.chapter,
                       fused.rrf_score AS retrieval_score,
                       fused.dense_score, fused.lexical_score
                FROM fused
                JOIN filtered f ON f.chunk_id = fused.chunk_id
                ORDER BY fused.rrf_score DESC,
                         COALESCE(fused.dense_score, -1) DESC,
                         f.chunk_id
                LIMIT $9
                """,
                np.asarray(query.query_embedding, dtype=np.float32),
                query.embedding_model,
                query.stage_code,
                query.grade,
                query.textbook,
                list(query.knowledge_codes)
                if query.knowledge_codes
                else ([query.knowledge_code] if query.knowledge_code else []),
                query.query_text,
                list(query.lexical_terms),
                query.limit,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("pgvector知识检索失败")
            raise RagModelError("knowledge_search_failed") from exc

        return tuple(
            DocumentCandidate(
                document_id=row["document_id"],
                text=row["content"],
                retrieval_score=float(row["retrieval_score"]),
                metadata={
                    **_read_metadata(row["metadata"]),
                    "chunkId": row["chunk_id"],
                    "title": row["title"],
                    "sourceUri": row["source_uri"],
                    "stageCode": row["stage_code"],
                    "grade": row["grade"],
                    "textbook": row["textbook"],
                    "chapter": row["chapter"],
                    "retrievalMode": "hybrid",
                    "denseScore": (
                        float(row["dense_score"])
                        if row["dense_score"] is not None
                        else None
                    ),
                    "lexicalScore": (
                        float(row["lexical_score"])
                        if row["lexical_score"] is not None
                        else None
                    ),
                },
            )
            for row in rows
        )

    async def delete_document(self, document_id: str) -> bool:
        pool = await self._get_pool()
        try:
            result = await pool.execute(
                "DELETE FROM k12_rag.knowledge_document WHERE document_id = $1",
                document_id,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("删除知识文档失败：document_id=%s", document_id)
            raise RagModelError("knowledge_delete_failed") from exc
        return result != "DELETE 0"

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def _get_pool(self) -> Any:
        if self._pool is not None:
            return self._pool
        async with self._pool_lock:
            if self._pool is None:
                try:
                    import asyncpg
                    from pgvector.asyncpg import register_vector

                    async def initialize(connection: Any) -> None:
                        await register_vector(connection)

                    self._pool = await asyncpg.create_pool(
                        dsn=self._database_url,
                        min_size=self._min_pool_size,
                        max_size=self._max_pool_size,
                        command_timeout=30,
                        init=initialize,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.exception("创建pgvector连接池失败")
                    raise RagModelError("knowledge_database_unavailable") from exc
        return self._pool


def _read_metadata(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    return {}
