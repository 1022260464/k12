import json
import logging
from typing import Any

from k12_agent_runtime.domain.rag import KnowledgeSearchResult, RankedDocument

logger = logging.getLogger(__name__)


class RedisKnowledgeSearchCache:
    """使用Redis缓存短期RAG结果；异常时降级为未命中，不阻断检索。"""

    def __init__(self, *, url: str, key_prefix: str, connect_timeout_seconds: float) -> None:
        from redis.asyncio import from_url

        self._client: Any = from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=connect_timeout_seconds,
            socket_timeout=connect_timeout_seconds,
            health_check_interval=30,
        )
        self._key_prefix = key_prefix.rstrip(":")
        self._version_key = f"{self._key_prefix}:rag:version"

    async def get(self, cache_key: str) -> KnowledgeSearchResult | None:
        try:
            version = await self._version()
            value = await self._client.get(self._result_key(version, cache_key))
            return _decode_result(value) if value else None
        except Exception:  # noqa: BLE001
            logger.warning("Redis RAG cache read failed; continue without cache", exc_info=True)
            return None

    async def set(
        self,
        cache_key: str,
        result: KnowledgeSearchResult,
        ttl_seconds: int,
    ) -> None:
        try:
            version = await self._version()
            await self._client.set(
                self._result_key(version, cache_key),
                _encode_result(result),
                ex=ttl_seconds,
            )
        except Exception:  # noqa: BLE001
            logger.warning("Redis RAG cache write failed; continue without cache", exc_info=True)

    async def invalidate(self) -> None:
        try:
            await self._client.incr(self._version_key)
        except Exception:  # noqa: BLE001
            logger.warning("Redis RAG cache invalidation failed", exc_info=True)

    async def close(self) -> None:
        await self._client.aclose()

    async def _version(self) -> int:
        value = await self._client.get(self._version_key)
        return int(value) if value is not None else 0

    def _result_key(self, version: int, cache_key: str) -> str:
        return f"{self._key_prefix}:rag:search:v{version}:{cache_key}"


def _encode_result(result: KnowledgeSearchResult) -> str:
    return json.dumps(
        {
            "query": result.query,
            "embedding_model": result.embedding_model,
            "candidate_count": result.candidate_count,
            "documents": [
                {
                    "document_id": item.document_id,
                    "text": item.text,
                    "rerank_score": item.rerank_score,
                    "metadata": item.metadata,
                    "retrieval_score": item.retrieval_score,
                }
                for item in result.documents
            ],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _decode_result(value: str) -> KnowledgeSearchResult:
    payload = json.loads(value)
    return KnowledgeSearchResult(
        query=payload["query"],
        embedding_model=payload["embedding_model"],
        candidate_count=int(payload["candidate_count"]),
        documents=tuple(
            RankedDocument(
                document_id=item["document_id"],
                text=item["text"],
                rerank_score=float(item["rerank_score"]),
                metadata=dict(item.get("metadata") or {}),
                retrieval_score=(
                    float(item["retrieval_score"])
                    if item.get("retrieval_score") is not None
                    else None
                ),
            )
            for item in payload["documents"]
        ),
    )
