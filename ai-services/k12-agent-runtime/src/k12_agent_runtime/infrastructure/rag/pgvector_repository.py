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
from k12_agent_runtime.infrastructure.rag.bge import RagModelError

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
                SELECT
                    chunk_id,
                    document_id,
                    content,
                    metadata,
                    title,
                    source_uri,
                    stage_code,
                    grade,
                    textbook,
                    chapter,
                    1 - (embedding <=> $1) AS retrieval_score
                FROM k12_rag.knowledge_chunk
                WHERE embedding_model = $2
                  AND ($3::text IS NULL OR stage_code = $3)
                  AND ($4::text IS NULL OR grade = $4)
                  AND ($5::text IS NULL OR textbook = $5)
                  AND (
                    cardinality($6::text[]) = 0
                    OR COALESCE(metadata->>'knowledgeCode', '') = ANY($6::text[])
                  )
                ORDER BY embedding <=> $1
                LIMIT $7
                """,
                np.asarray(query.query_embedding, dtype=np.float32),
                query.embedding_model,
                query.stage_code,
                query.grade,
                query.textbook,
                list(query.knowledge_codes)
                if query.knowledge_codes
                else ([query.knowledge_code] if query.knowledge_code else []),
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
