from dataclasses import dataclass

from k12_agent_runtime.application.agents.run_agent import RunAgentUseCase
from k12_agent_runtime.application.rag import EmbedTextsUseCase, RerankDocumentsUseCase
from k12_agent_runtime.application.sandbox.execute_code import ExecuteCodeUseCase
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.agents.ports import AgentRegistry
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.infrastructure.agents.demo_chart_agent import DemoChartAgent
from k12_agent_runtime.infrastructure.agents.registry import InMemoryAgentRegistry
from k12_agent_runtime.infrastructure.agents.study_plan import StudyPlanAgent
from k12_agent_runtime.infrastructure.agents.teaching_assistant import TeachingAssistantAgent
from k12_agent_runtime.infrastructure.llm import DashScopeChatModel
from k12_agent_runtime.infrastructure.rag import BgeM3Embedder, BgeReranker
from k12_agent_runtime.infrastructure.sandbox.disabled import DisabledCodeSandbox


@dataclass(frozen=True, slots=True)
class ApplicationContainer:
    settings: Settings
    agent_registry: AgentRegistry
    run_agent: RunAgentUseCase
    execute_code: ExecuteCodeUseCase
    chat_model: ChatModel | None
    embed_texts: EmbedTextsUseCase
    rerank_documents: RerankDocumentsUseCase


def build_container(settings: Settings) -> ApplicationContainer:
    chat_model = _build_chat_model(settings)
    embedder, reranker = _build_rag_models(settings)
    # 新Agent需要在注册器中登记，接口才能通过agent_code找到它。
    registry = InMemoryAgentRegistry(
        [DemoChartAgent(), StudyPlanAgent(), TeachingAssistantAgent(chat_model)]
    )
    sandbox = DisabledCodeSandbox()
    return ApplicationContainer(
        settings=settings,
        agent_registry=registry,
        run_agent=RunAgentUseCase(registry),
        execute_code=ExecuteCodeUseCase(sandbox),
        chat_model=chat_model,
        embed_texts=EmbedTextsUseCase(embedder),
        rerank_documents=RerankDocumentsUseCase(reranker),
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


def _build_rag_models(settings: Settings) -> tuple[BgeM3Embedder | None, BgeReranker | None]:
    """只创建延迟加载适配器，真正的模型在第一次请求时加载。"""
    if not settings.rag_enabled:
        return None, None

    embedder = BgeM3Embedder(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_use_fp16,
        batch_size=settings.embedding_batch_size,
        max_length=settings.embedding_max_length,
        cache_dir=settings.model_cache_dir,
    )
    reranker = BgeReranker(
        model_name=settings.reranker_model,
        device=settings.reranker_device,
        use_fp16=settings.reranker_use_fp16,
        batch_size=settings.reranker_batch_size,
        max_length=settings.reranker_max_length,
        cache_dir=settings.model_cache_dir,
    )
    return embedder, reranker
