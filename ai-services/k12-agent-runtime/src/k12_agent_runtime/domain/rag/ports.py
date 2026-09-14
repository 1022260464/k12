from typing import Protocol

from k12_agent_runtime.domain.rag.models import (
    DocumentCandidate,
    EmbeddingBatch,
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
