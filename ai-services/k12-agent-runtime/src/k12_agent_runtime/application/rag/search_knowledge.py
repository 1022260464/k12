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
    knowledge_code: str | None = None
    knowledge_codes: tuple[str, ...] = ()


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
        codes = tuple(
            code
            for code in (
                *(command.knowledge_codes or ()),
                *((command.knowledge_code,) if command.knowledge_code else ()),
            )
            if code
        )
        # 去重且保序
        seen: set[str] = set()
        unique_codes: list[str] = []
        for code in codes:
            if code not in seen:
                seen.add(code)
                unique_codes.append(code)
        candidates = await self._repository.search(
            KnowledgeSearchQuery(
                query_embedding=embedding_batch.vectors[0],
                embedding_model=embedding_batch.model,
                limit=max(command.candidate_count, command.top_k),
                stage_code=command.stage_code,
                grade=command.grade,
                textbook=command.textbook,
                knowledge_code=command.knowledge_code,
                knowledge_codes=tuple(unique_codes),
            )
        )
        # GraphRAG：按知识点无命中时，去掉学段/年级限制再按同一 knowledgeCode 搜一次。
        # 不再回退到「无 knowledgeCode」的同学段检索，避免旧 demo（冒泡排序等）串进推荐。
        if not candidates and unique_codes:
            candidates = await self._repository.search(
                KnowledgeSearchQuery(
                    query_embedding=embedding_batch.vectors[0],
                    embedding_model=embedding_batch.model,
                    limit=max(command.candidate_count, command.top_k),
                    knowledge_code=command.knowledge_code,
                    knowledge_codes=tuple(unique_codes),
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
                "knowledge_code": command.knowledge_code,
                "knowledge_codes": list(command.knowledge_codes or ()),
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return sha256(payload.encode("utf-8")).hexdigest()
