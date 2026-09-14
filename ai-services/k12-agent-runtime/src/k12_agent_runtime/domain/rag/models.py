from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class EmbeddingBatch:
    """一批归一化后的稠密向量。"""

    model: str
    dimension: int
    vectors: tuple[tuple[float, ...], ...]


@dataclass(frozen=True, slots=True)
class DocumentCandidate:
    """向量检索得到、等待重排的候选知识片段。"""

    document_id: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)
    retrieval_score: float | None = None


@dataclass(frozen=True, slots=True)
class RankedDocument:
    """Reranker计算相关性后返回的知识片段。"""

    document_id: str
    text: str
    rerank_score: float
    metadata: dict[str, Any] = field(default_factory=dict)
    retrieval_score: float | None = None
