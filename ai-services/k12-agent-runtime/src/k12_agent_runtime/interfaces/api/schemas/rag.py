from typing import Annotated, Any

from pydantic import Field

from k12_agent_runtime.domain.rag import EmbeddingBatch, RankedDocument
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
