import json
import logging
from dataclasses import dataclass
from hashlib import sha256

from k12_agent_runtime.application.rag.embed_texts import RagDisabledError
from k12_agent_runtime.domain.rag import (
    DocumentReranker,
    KnowledgeRepository,
    KnowledgeSearchCache,
    KnowledgeSearchQuery,
    KnowledgeSearchResult,
    TextEmbedder,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SearchKnowledgeCommand:
    query: str
    candidate_count: int
    top_k: int
    stage_code: str | None = None
    grade: str | None = None
    textbook: str | None = None


class SearchKnowledgeUseCase:
    def __init__(
        self,
        embedder: TextEmbedder | None,
        reranker: DocumentReranker | None,
        repository: KnowledgeRepository | None,
        cache: KnowledgeSearchCache | None = None,
        cache_ttl_seconds: int = 300,
        cache_scope: str = "default",
    ) -> None:
        self._embedder = embedder
        self._reranker = reranker
        self._repository = repository
        self._cache = cache
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache_scope = cache_scope

    async def execute(self, command: SearchKnowledgeCommand) -> KnowledgeSearchResult:
        if self._embedder is None or self._reranker is None or self._repository is None:
            raise RagDisabledError("RAG知识检索尚未启用")
        query = command.query.strip()
        if not query:
            raise ValueError("检索问题不能为空")

        cache_key = self._build_cache_key(command, query)
        if self._cache is not None:
            try:
                cached = await self._cache.get(cache_key)
                if cached is not None:
                    return cached
            except Exception:  # noqa: BLE001
                logger.warning("RAG cache lookup failed; continue with retrieval", exc_info=True)

        embedding_batch = await self._embedder.embed((query,))
        candidates = await self._repository.search(
            KnowledgeSearchQuery(
                query_embedding=embedding_batch.vectors[0],
                embedding_model=embedding_batch.model,
                limit=max(command.candidate_count, command.top_k),
                stage_code=command.stage_code,
                grade=command.grade,
                textbook=command.textbook,
            )
        )
        ranked = (
            await self._reranker.rerank(query, candidates, command.top_k)
            if candidates
            else ()
        )
        result = KnowledgeSearchResult(
            query=query,
            embedding_model=embedding_batch.model,
            candidate_count=len(candidates),
            documents=ranked,
        )
        if self._cache is not None:
            try:
                await self._cache.set(cache_key, result, self._cache_ttl_seconds)
            except Exception:  # noqa: BLE001
                logger.warning("RAG cache write failed", exc_info=True)
        return result

    def _build_cache_key(self, command: SearchKnowledgeCommand, query: str) -> str:
        payload = json.dumps(
            {
                "scope": self._cache_scope,
                "query": query,
                "candidate_count": command.candidate_count,
                "top_k": command.top_k,
                "stage_code": command.stage_code,
                "grade": command.grade,
                "textbook": command.textbook,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return sha256(payload.encode("utf-8")).hexdigest()
