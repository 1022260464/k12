from typing import Protocol

from k12_agent_runtime.domain.rag.models import (
    DocumentCandidate,
    EmbeddingBatch,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeSearchQuery,
    KnowledgeSearchResult,
    RankedDocument,
)


class TextEmbedder(Protocol):
    """将查询或知识片段转换为向量的领域端口。"""

    async def embed(self, texts: tuple[str, ...]) -> EmbeddingBatch: ...


class DocumentReranker(Protocol):
    """对向量检索候选集进行精排的领域端口。"""

    async def rerank(
        self,
        query: str,
        documents: tuple[DocumentCandidate, ...],
        top_k: int,
    ) -> tuple[RankedDocument, ...]: ...


class KnowledgeRepository(Protocol):
    """知识文档和向量片段存储端口。"""

    async def replace_document(
        self,
        document: KnowledgeDocument,
        chunks: tuple[KnowledgeChunk, ...],
    ) -> None: ...

    async def search(
        self,
        query: KnowledgeSearchQuery,
    ) -> tuple[DocumentCandidate, ...]: ...

    async def delete_document(self, document_id: str) -> bool: ...

    async def close(self) -> None: ...


class KnowledgeSearchCache(Protocol):
    """RAG最终检索结果的短期缓存端口。"""

    async def get(self, cache_key: str) -> KnowledgeSearchResult | None: ...

    async def set(
        self,
        cache_key: str,
        result: KnowledgeSearchResult,
        ttl_seconds: int,
    ) -> None: ...

    async def invalidate(self) -> None: ...

    async def close(self) -> None: ...
