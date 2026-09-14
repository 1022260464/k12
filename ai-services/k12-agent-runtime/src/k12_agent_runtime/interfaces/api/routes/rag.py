from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.rag import (
    EmbedTextsCommand,
    RerankDocumentsCommand,
)
from k12_agent_runtime.application.rag.embed_texts import RagDisabledError
from k12_agent_runtime.domain.rag import DocumentCandidate
from k12_agent_runtime.infrastructure.rag import RagModelError
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse
from k12_agent_runtime.interfaces.api.schemas.rag import (
    EmbeddingRequest,
    EmbeddingResponse,
    RagCapabilitiesResponse,
    RankedDocumentResponse,
    RerankRequest,
    RerankResponse,
)

router = APIRouter(
    prefix="/rag",
    tags=["rag"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("/capabilities", response_model=ApiResponse[RagCapabilitiesResponse])
async def capabilities(request: Request) -> ApiResponse[RagCapabilitiesResponse]:
    settings = get_container(request).settings
    return ApiResponse[RagCapabilitiesResponse].ok(
        RagCapabilitiesResponse(
            enabled=settings.rag_enabled,
            embedding_model=settings.embedding_model,
            embedding_device=settings.embedding_device,
            reranker_model=settings.reranker_model,
            reranker_device=settings.reranker_device,
            loading_strategy="lazy",
        )
    )


@router.post("/embeddings", response_model=ApiResponse[EmbeddingResponse])
async def embed_texts(
    body: EmbeddingRequest,
    request: Request,
) -> ApiResponse[EmbeddingResponse] | JSONResponse:
    try:
        result = await get_container(request).embed_texts.execute(
            EmbedTextsCommand(texts=tuple(body.texts))
        )
    except (RagDisabledError, RagModelError) as error:
        return _unavailable(error)
    return ApiResponse[EmbeddingResponse].ok(EmbeddingResponse.from_domain(result))


@router.post("/rerank", response_model=ApiResponse[RerankResponse])
async def rerank_documents(
    body: RerankRequest,
    request: Request,
) -> ApiResponse[RerankResponse] | JSONResponse:
    settings = get_container(request).settings
    command = RerankDocumentsCommand(
        query=body.query,
        documents=tuple(
            DocumentCandidate(
                document_id=item.document_id,
                text=item.text,
                metadata=item.metadata,
                retrieval_score=item.retrieval_score,
            )
            for item in body.documents
        ),
        top_k=body.top_k,
    )
    try:
        results = await get_container(request).rerank_documents.execute(command)
    except (RagDisabledError, RagModelError) as error:
        return _unavailable(error)
    response = RerankResponse(
        model=settings.reranker_model,
        documents=[RankedDocumentResponse.from_domain(item) for item in results],
    )
    return ApiResponse[RerankResponse].ok(response)


def _unavailable(error: Exception) -> JSONResponse:
    message = "本地RAG模型不可用" if isinstance(error, RagModelError) else str(error)
    response = ApiResponse[object].fail(503, message)
    return JSONResponse(
        status_code=503,
        content=response.model_dump(mode="json", by_alias=True),
    )
