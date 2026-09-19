import asyncio
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.rag import (
    EmbedTextsCommand,
    IndexDocumentCommand,
    RerankDocumentsCommand,
    SearchKnowledgeCommand,
)
from k12_agent_runtime.application.rag.embed_texts import RagDisabledError
from k12_agent_runtime.application.rag.index_teaching_resource import IndexTeachingResourceCommand
from k12_agent_runtime.domain.rag import DocumentCandidate, KnowledgeDocument
from k12_agent_runtime.infrastructure.rag import RagModelError
from k12_agent_runtime.infrastructure.storage.minio_storage import ObjectStorageError
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse
from k12_agent_runtime.interfaces.api.schemas.rag import (
    EmbeddingRequest,
    EmbeddingResponse,
    IndexDocumentRequest,
    IndexedDocumentResponse,
    IndexTeachingResourceRequest,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
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
            storage_enabled=(
                settings.rag_enabled and settings.rag_database_url is not None
            ),
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


@router.post("/documents/index", response_model=ApiResponse[IndexedDocumentResponse])
async def index_document(
    body: IndexDocumentRequest,
    request: Request,
) -> ApiResponse[IndexedDocumentResponse] | JSONResponse:
    document = KnowledgeDocument(
        document_id=body.document_id or str(uuid4()),
        title=body.title,
        content=body.content,
        source_type=body.source_type,
        source_uri=body.source_uri,
        stage_code=body.stage_code,
        grade=body.grade,
        textbook=body.textbook,
        chapter=body.chapter,
        metadata=body.metadata,
    )
    try:
        result = await get_container(request).index_document.execute(
            IndexDocumentCommand(document=document)
        )
    except (RagDisabledError, RagModelError) as error:
        return _unavailable(error)
    return ApiResponse[IndexedDocumentResponse].ok(
        IndexedDocumentResponse.from_domain(result)
    )


@router.post(
    "/teaching-resources/index", response_model=ApiResponse[IndexedDocumentResponse]
)
async def index_teaching_resource(
    body: IndexTeachingResourceRequest, request: Request
) -> ApiResponse[IndexedDocumentResponse] | JSONResponse:
    command = IndexTeachingResourceCommand(
        resource_id=body.resource_id,
        title=body.title,
        object_key=body.object_key,
        stage_code=body.stage_code,
        subject=body.subject,
        source_note=body.source_note,
        course_id=body.course_id,
        chapter_id=body.chapter_id,
        chapter=body.chapter,
        grade=body.grade,
        textbook=body.textbook,
        knowledge_code=body.knowledge_code,
        description=body.description,
    )
    try:
        # 上游连接可能提前中断；限制后台工作时长，避免撤回后继续写入旧向量。
        async with asyncio.timeout(240):
            result = await get_container(request).index_teaching_resource.execute(command)
    except ValueError as error:
        return _error(422, str(error))
    except TimeoutError:
        return _unavailable(RagDisabledError("知识库入库处理超时"))
    except (RagDisabledError, RagModelError, ObjectStorageError, RuntimeError) as error:
        return _unavailable(error)
    return ApiResponse[IndexedDocumentResponse].ok(
        IndexedDocumentResponse.from_domain(result)
    )


@router.delete("/teaching-resources/{resource_id}/index", response_model=ApiResponse[dict])
async def delete_teaching_resource_index(
    resource_id: int, request: Request
) -> ApiResponse[dict] | JSONResponse:
    container = get_container(request)
    if resource_id < 1:
        return _error(422, "资料标识不合法")
    if container.knowledge_repository is None:
        return _unavailable(RagDisabledError("RAG知识库存储尚未启用"))
    try:
        deleted = await container.knowledge_repository.delete_document(
            f"teaching-resource-{resource_id}"
        )
        if container.rag_cache is not None:
            await container.rag_cache.invalidate()
    except RagModelError as error:
        return _unavailable(error)
    return ApiResponse[dict].ok({"deleted": deleted})


@router.post("/search", response_model=ApiResponse[KnowledgeSearchResponse])
async def search_knowledge(
    body: KnowledgeSearchRequest,
    request: Request,
) -> ApiResponse[KnowledgeSearchResponse] | JSONResponse:
    settings = get_container(request).settings
    try:
        result = await get_container(request).search_knowledge.execute(
            SearchKnowledgeCommand(
                query=body.query,
                candidate_count=body.candidate_count or settings.rag_candidate_count,
                top_k=body.top_k or settings.rag_top_k,
                stage_code=body.stage_code,
                grade=body.grade,
                textbook=body.textbook,
                knowledge_code=body.knowledge_code,
                knowledge_codes=tuple(body.knowledge_codes or ()),
            )
        )
    except (RagDisabledError, RagModelError) as error:
        return _unavailable(error)
    return ApiResponse[KnowledgeSearchResponse].ok(
        KnowledgeSearchResponse.from_domain(result)
    )


def _unavailable(error: Exception) -> JSONResponse:
    message = "本地RAG模型不可用" if isinstance(error, RagModelError) else str(error)
    response = ApiResponse[object].fail(503, message)
    return JSONResponse(
        status_code=503,
        content=response.model_dump(mode="json", by_alias=True),
    )


def _error(status_code: int, message: str) -> JSONResponse:
    response = ApiResponse[object].fail(status_code, message)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )
