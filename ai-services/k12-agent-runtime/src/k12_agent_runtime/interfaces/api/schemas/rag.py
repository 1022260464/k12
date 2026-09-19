from typing import Annotated, Any

from pydantic import Field

from k12_agent_runtime.domain.rag import (
    EmbeddingBatch,
    IndexedDocument,
    KnowledgeSearchResult,
    RankedDocument,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel

NonBlankText = Annotated[str, Field(min_length=1, max_length=4000)]


class EmbeddingRequest(ApiModel):
    texts: list[NonBlankText] = Field(min_length=1, max_length=64)


class EmbeddingResponse(ApiModel):
    model: str
    dimension: int
    vectors: list[list[float]]

    @classmethod
    def from_domain(cls, result: EmbeddingBatch) -> "EmbeddingResponse":
        return cls(
            model=result.model,
            dimension=result.dimension,
            vectors=[list(vector) for vector in result.vectors],
        )


class DocumentCandidateRequest(ApiModel):
    document_id: str = Field(min_length=1, max_length=128)
    text: NonBlankText
    metadata: dict[str, Any] = Field(default_factory=dict)
    retrieval_score: float | None = None


class RerankRequest(ApiModel):
    query: NonBlankText
    documents: list[DocumentCandidateRequest] = Field(min_length=1, max_length=50)
    top_k: int = Field(default=5, ge=1, le=20)


class RankedDocumentResponse(ApiModel):
    document_id: str
    text: str
    rerank_score: float
    metadata: dict[str, Any]
    retrieval_score: float | None

    @classmethod
    def from_domain(cls, result: RankedDocument) -> "RankedDocumentResponse":
        return cls(
            document_id=result.document_id,
            text=result.text,
            rerank_score=result.rerank_score,
            metadata=result.metadata,
            retrieval_score=result.retrieval_score,
        )


class RerankResponse(ApiModel):
    model: str
    documents: list[RankedDocumentResponse]


class RagCapabilitiesResponse(ApiModel):
    enabled: bool
    embedding_model: str
    embedding_device: str
    reranker_model: str
    reranker_device: str
    loading_strategy: str
    storage_enabled: bool


class IndexDocumentRequest(ApiModel):
    document_id: str | None = Field(default=None, min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=1_000_000)
    source_type: str = Field(default="manual", min_length=1, max_length=32)
    source_uri: str | None = Field(default=None, max_length=2000)
    stage_code: str | None = Field(default=None, max_length=32)
    grade: str | None = Field(default=None, max_length=32)
    textbook: str | None = Field(default=None, max_length=255)
    chapter: str | None = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class IndexTeachingResourceRequest(ApiModel):
    resource_id: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=160)
    object_key: str = Field(min_length=1, max_length=255)
    stage_code: str = Field(min_length=1, max_length=32)
    subject: str = Field(min_length=1, max_length=64)
    source_note: str = Field(min_length=1, max_length=255)
    course_id: int | None = Field(default=None, ge=1)
    chapter_id: int | None = Field(default=None, ge=1)
    chapter: str | None = Field(default=None, min_length=1, max_length=128)
    grade: str | None = Field(default=None, min_length=1, max_length=32)
    textbook: str | None = Field(default=None, min_length=1, max_length=255)
    knowledge_code: str | None = Field(
        default=None, pattern=r"^[a-z][a-z0-9_.-]{2,63}$"
    )
    description: str | None = Field(default=None, max_length=1000)


class IndexedDocumentResponse(ApiModel):
    document_id: str
    chunk_count: int
    embedding_model: str

    @classmethod
    def from_domain(cls, result: IndexedDocument) -> "IndexedDocumentResponse":
        return cls(
            document_id=result.document_id,
            chunk_count=result.chunk_count,
            embedding_model=result.embedding_model,
        )


class KnowledgeSearchRequest(ApiModel):
    query: NonBlankText
    candidate_count: int | None = Field(default=None, ge=1, le=100)
    top_k: int | None = Field(default=None, ge=1, le=20)
    stage_code: str | None = Field(default=None, max_length=32)
    grade: str | None = Field(default=None, max_length=32)
    textbook: str | None = Field(default=None, max_length=255)
    knowledge_code: str | None = Field(default=None, max_length=64)
    knowledge_codes: list[str] | None = Field(default=None, max_length=20)


class KnowledgeSearchResponse(ApiModel):
    query: str
    embedding_model: str
    candidate_count: int
    documents: list[RankedDocumentResponse]

    @classmethod
    def from_domain(cls, result: KnowledgeSearchResult) -> "KnowledgeSearchResponse":
        return cls(
            query=result.query,
            embedding_model=result.embedding_model,
            candidate_count=result.candidate_count,
            documents=[RankedDocumentResponse.from_domain(item) for item in result.documents],
        )
