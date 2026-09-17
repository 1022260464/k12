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


@dataclass(frozen=True, slots=True)
class KnowledgeDocument:
    """待写入知识库的教材、课程文档或教师资料。"""

    document_id: str
    title: str
    content: str
    source_type: str
    source_uri: str | None = None
    stage_code: str | None = None
    grade: str | None = None
    textbook: str | None = None
    chapter: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class KnowledgeChunk:
    """带来源信息和向量的最小检索单元。"""

    chunk_id: str
    document_id: str
    chunk_index: int
    title: str
    content: str
    embedding: tuple[float, ...]
    embedding_model: str
    source_uri: str | None = None
    stage_code: str | None = None
    grade: str | None = None
    textbook: str | None = None
    chapter: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class KnowledgeSearchQuery:
    query_embedding: tuple[float, ...]
    embedding_model: str
    limit: int
    stage_code: str | None = None
    grade: str | None = None
    textbook: str | None = None


@dataclass(frozen=True, slots=True)
class IndexedDocument:
    document_id: str
    chunk_count: int
    embedding_model: str


@dataclass(frozen=True, slots=True)
class KnowledgeSearchResult:
    query: str
    embedding_model: str
    candidate_count: int
    documents: tuple[RankedDocument, ...]
