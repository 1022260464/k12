import asyncio
from dataclasses import dataclass

from k12_agent_runtime.application.agents.run_agent import RunAgentUseCase
from k12_agent_runtime.application.rag import (
    EmbedTextsUseCase,
    IndexDocumentUseCase,
    RerankDocumentsUseCase,
    SearchKnowledgeUseCase,
)
from k12_agent_runtime.application.rag.chunk_text import TextChunker
from k12_agent_runtime.application.rag.index_teaching_resource import IndexTeachingResourceUseCase
from k12_agent_runtime.application.sandbox.execute_code import ExecuteCodeUseCase
from k12_agent_runtime.application.storage import (
    CreateDownloadUrlUseCase,
    StoreObjectUseCase,
)
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.agents.ports import AgentRegistry
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.domain.rag.ports import DocumentReranker, TextEmbedder
from k12_agent_runtime.domain.sandbox.ports import CodeSandbox
from k12_agent_runtime.infrastructure.agents.demo_chart_agent import DemoChartAgent
from k12_agent_runtime.infrastructure.agents.python_code_coach import PythonCodeCoachAgent
from k12_agent_runtime.infrastructure.agents.registry import InMemoryAgentRegistry
from k12_agent_runtime.infrastructure.agents.study_plan import StudyPlanAgent
from k12_agent_runtime.infrastructure.agents.teaching_assistant import TeachingAssistantAgent
from k12_agent_runtime.infrastructure.cache import RedisKnowledgeSearchCache
from k12_agent_runtime.infrastructure.llm import DashScopeChatModel
from k12_agent_runtime.infrastructure.observability import MongoAgentTraceRepository
from k12_agent_runtime.infrastructure.rag import (
    BgeM3Embedder,
    BgeReranker,
    DashScopeEmbedder,
    DashScopeReranker,
    PgVectorKnowledgeRepository,
)
from k12_agent_runtime.infrastructure.sandbox import (
    DisabledCodeSandbox,
    FailoverCodeSandbox,
    PistonCodeSandbox,
    TencentAgentSandboxAdapter,
)
from k12_agent_runtime.infrastructure.storage import MinioObjectStorage


@dataclass(frozen=True, slots=True)
class ApplicationContainer:
    settings: Settings
    agent_registry: AgentRegistry
    run_agent: RunAgentUseCase
    execute_code: ExecuteCodeUseCase
    chat_model: ChatModel | None
    embed_texts: EmbedTextsUseCase
    rerank_documents: RerankDocumentsUseCase
    index_document: IndexDocumentUseCase
    index_teaching_resource: IndexTeachingResourceUseCase
    search_knowledge: SearchKnowledgeUseCase
    knowledge_repository: PgVectorKnowledgeRepository | None
    rag_cache: RedisKnowledgeSearchCache | None
    trace_repository: MongoAgentTraceRepository | None
    store_object: StoreObjectUseCase
    create_download_url: CreateDownloadUrlUseCase

    async def close(self) -> None:
        resources = [
            resource
            for resource in (
                self.knowledge_repository,
                self.rag_cache,
                self.trace_repository,
            )
            if resource is not None
        ]
        await asyncio.gather(*(resource.close() for resource in resources))


def build_container(settings: Settings) -> ApplicationContainer:
    chat_model = _build_chat_model(settings)
    embedder, reranker = _build_rag_models(settings)
    repository = _build_knowledge_repository(settings)
    rag_cache = _build_rag_cache(settings)
    trace_repository = _build_trace_repository(settings)
    object_storage = _build_object_storage(settings)
    store_object = StoreObjectUseCase(object_storage, settings.minio_max_upload_bytes)
    chunker = TextChunker(settings.rag_chunk_size, settings.rag_chunk_overlap)
    index_document = IndexDocumentUseCase(embedder, repository, chunker, rag_cache)
    search_knowledge = SearchKnowledgeUseCase(
        embedder,
        reranker,
        repository,
        rag_cache,
        settings.rag_cache_ttl_seconds,
        ":".join(
            (
                settings.embedding_provider,
                settings.embedding_model,
                settings.reranker_provider,
                settings.reranker_model,
            )
        ),
    )
    # 新Agent需要在注册器中登记，接口才能通过agent_code找到它。
    registry = InMemoryAgentRegistry(
        [
            DemoChartAgent(),
            StudyPlanAgent(),
            TeachingAssistantAgent(
                chat_model,
                search_knowledge=search_knowledge,
                rag_candidate_count=settings.rag_candidate_count,
                rag_top_k=settings.rag_top_k,
            ),
            PythonCodeCoachAgent(chat_model),
        ]
    )
    sandbox = _build_code_sandbox(settings, store_object)
    return ApplicationContainer(
        settings=settings,
        agent_registry=registry,
        run_agent=RunAgentUseCase(registry, trace_repository),
        execute_code=ExecuteCodeUseCase(sandbox),
        chat_model=chat_model,
        embed_texts=EmbedTextsUseCase(embedder),
        rerank_documents=RerankDocumentsUseCase(reranker),
        index_document=index_document,
        index_teaching_resource=IndexTeachingResourceUseCase(
            object_storage, index_document, settings.minio_bucket
        ),
        search_knowledge=search_knowledge,
        knowledge_repository=repository,
        rag_cache=rag_cache,
        trace_repository=trace_repository,
        store_object=store_object,
        create_download_url=CreateDownloadUrlUseCase(
            object_storage,
            settings.minio_presigned_ttl_seconds,
        ),
    )


def _build_chat_model(settings: Settings) -> ChatModel | None:
    """根据配置装配模型适配器；全部留空时维持无模型的本地开发模式。"""
    provider = settings.llm_provider.strip().lower()
    base_url = settings.llm_base_url.strip()
    model = settings.llm_model.strip()
    api_key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else ""

    values = (provider, base_url, model, api_key)
    if not any(values):
        return None
    if not all(values):
        raise ValueError(
            "大模型配置不完整，请同时设置 provider、base_url、api_key 和 model"
        )
    if provider not in {"dashscope", "qwen", "aliyun"}:
        raise ValueError(f"暂不支持的大模型提供方：{provider}")

    return DashScopeChatModel(
        base_url=base_url,
        api_key=api_key,
        model=model,
        timeout_seconds=settings.llm_timeout_seconds,
    )


def _build_rag_models(
    settings: Settings,
) -> tuple[TextEmbedder | None, DocumentReranker | None]:
    """根据provider装配云端或本地RAG模型适配器。"""
    if not settings.rag_enabled:
        return None, None

    embedding_provider = settings.embedding_provider.strip().lower()
    reranker_provider = settings.reranker_provider.strip().lower()
    shared_key = settings.llm_api_key.get_secret_value() if settings.llm_api_key else ""

    if embedding_provider in {"dashscope", "aliyun", "bailian"}:
        configured_embedding_key = (
            settings.embedding_api_key.get_secret_value() if settings.embedding_api_key else ""
        )
        embedding_key = configured_embedding_key.strip() or shared_key
        embedder: TextEmbedder = DashScopeEmbedder(
            base_url=settings.embedding_base_url,
            api_key=embedding_key,
            model=settings.embedding_model,
            dimension=settings.embedding_dimension,
            batch_size=min(settings.embedding_batch_size, 10),
            timeout_seconds=settings.embedding_timeout_seconds,
        )
    elif embedding_provider in {"local", "bge", "local_bge"}:
        embedder = BgeM3Embedder(
            model_name=settings.embedding_model,
            device=settings.embedding_device,
            use_fp16=settings.embedding_use_fp16,
            batch_size=settings.embedding_batch_size,
            max_length=settings.embedding_max_length,
            cache_dir=settings.model_cache_dir,
        )
    else:
        raise ValueError(f"暂不支持的Embedding提供方：{embedding_provider}")

    if reranker_provider in {"dashscope", "aliyun", "bailian"}:
        configured_reranker_key = (
            settings.reranker_api_key.get_secret_value() if settings.reranker_api_key else ""
        )
        reranker_key = configured_reranker_key.strip() or shared_key
        reranker: DocumentReranker = DashScopeReranker(
            base_url=settings.reranker_base_url,
            api_key=reranker_key,
            model=settings.reranker_model,
            instruction=settings.reranker_instruction,
            timeout_seconds=settings.reranker_timeout_seconds,
        )
    elif reranker_provider in {"local", "bge", "local_bge"}:
        reranker = BgeReranker(
            model_name=settings.reranker_model,
            device=settings.reranker_device,
            use_fp16=settings.reranker_use_fp16,
            batch_size=settings.reranker_batch_size,
            max_length=settings.reranker_max_length,
            cache_dir=settings.model_cache_dir,
        )
    else:
        raise ValueError(f"暂不支持的Reranker提供方：{reranker_provider}")
    return embedder, reranker


def _build_knowledge_repository(
    settings: Settings,
) -> PgVectorKnowledgeRepository | None:
    if not settings.rag_enabled or settings.rag_database_url is None:
        return None
    return PgVectorKnowledgeRepository(
        database_url=settings.rag_database_url.get_secret_value(),
        min_pool_size=settings.rag_database_min_pool_size,
        max_pool_size=settings.rag_database_max_pool_size,
    )


def _build_rag_cache(settings: Settings) -> RedisKnowledgeSearchCache | None:
    if not settings.redis_enabled:
        return None
    if settings.redis_url is None:
        raise ValueError("Redis已启用，但K12_AGENT_REDIS_URL未配置")
    return RedisKnowledgeSearchCache(
        url=settings.redis_url.get_secret_value(),
        key_prefix=settings.redis_key_prefix,
        connect_timeout_seconds=settings.redis_connect_timeout_seconds,
    )


def _build_trace_repository(settings: Settings) -> MongoAgentTraceRepository | None:
    if not settings.mongodb_enabled:
        return None
    if settings.mongodb_url is None:
        raise ValueError("MongoDB已启用，但K12_AGENT_MONGODB_URL未配置")
    return MongoAgentTraceRepository(
        url=settings.mongodb_url.get_secret_value(),
        database=settings.mongodb_database,
        collection=settings.mongodb_trace_collection,
        connect_timeout_ms=settings.mongodb_connect_timeout_ms,
        retention_days=settings.mongodb_trace_retention_days,
    )


def _build_object_storage(settings: Settings) -> MinioObjectStorage | None:
    if not settings.minio_enabled:
        return None
    if settings.minio_access_key is None or settings.minio_secret_key is None:
        raise ValueError("MinIO已启用，但Access Key或Secret Key未配置")
    return MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key.get_secret_value(),
        secret_key=settings.minio_secret_key.get_secret_value(),
        bucket=settings.minio_bucket,
        secure=settings.minio_secure,
        region=settings.minio_region,
        connect_timeout_seconds=settings.minio_connect_timeout_seconds,
    )


def _build_code_sandbox(
    settings: Settings,
    store_object: StoreObjectUseCase,
) -> CodeSandbox:
    if not settings.sandbox_enabled:
        return DisabledCodeSandbox()

    provider = settings.sandbox_provider.strip().lower()
    primary = _build_sandbox_provider(settings, store_object, provider)
    fallback_provider = settings.sandbox_fallback_provider.strip().lower()
    if not fallback_provider:
        return primary
    if fallback_provider == provider:
        raise ValueError("主沙箱和备用沙箱不能使用同一个提供方")

    fallback = _build_sandbox_provider(settings, store_object, fallback_provider)
    return FailoverCodeSandbox(
        primary=primary,
        fallback=fallback,
        primary_name=provider,
        fallback_name=fallback_provider,
        cooldown_seconds=settings.sandbox_fallback_cooldown_seconds,
    )


def _build_sandbox_provider(
    settings: Settings,
    store_object: StoreObjectUseCase,
    provider: str,
) -> CodeSandbox:
    if provider == "tencent_agsx":
        api_key = settings.e2b_api_key.get_secret_value() if settings.e2b_api_key else ""
        if not settings.e2b_domain.strip() or not api_key or not settings.sandbox_template.strip():
            raise ValueError("腾讯云沙箱已启用，但Domain、API Key或模板名称未配置")
        return TencentAgentSandboxAdapter(
            domain=settings.e2b_domain,
            api_key=api_key,
            template=settings.sandbox_template,
            provider_request_timeout_seconds=(
                settings.sandbox_provider_request_timeout_seconds
            ),
            instance_timeout_seconds=settings.sandbox_instance_timeout_seconds,
            max_timeout_seconds=settings.sandbox_timeout_seconds,
            max_output_bytes=settings.sandbox_max_output_bytes,
            max_result_items=settings.sandbox_max_result_items,
            max_artifacts=settings.sandbox_max_artifacts,
            max_artifact_bytes=min(
                settings.sandbox_max_artifact_bytes, settings.minio_max_upload_bytes
            ),
            max_concurrency=settings.sandbox_max_concurrency,
            max_waiters=settings.sandbox_max_waiters,
            queue_wait_seconds=settings.sandbox_queue_wait_seconds,
            store_object=store_object,
        )
    if provider == "local_piston":
        return PistonCodeSandbox(
            base_url=settings.piston_url,
            python_version=settings.piston_python_version,
            connect_timeout_seconds=settings.piston_connect_timeout_seconds,
            max_timeout_seconds=settings.sandbox_timeout_seconds,
            run_timeout_ms=settings.piston_run_timeout_ms,
            max_output_bytes=settings.sandbox_max_output_bytes,
            max_concurrency=settings.sandbox_max_concurrency,
            max_waiters=settings.sandbox_max_waiters,
            queue_wait_seconds=settings.sandbox_queue_wait_seconds,
        )
    raise ValueError("沙箱提供方只能是tencent_agsx或local_piston")
