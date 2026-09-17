from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from k12_agent_runtime.application.rag import SearchKnowledgeUseCase
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.infrastructure.agents.teaching_assistant.nodes import (
    build_high_school_explanation,
    build_interaction,
    build_lower_primary_explanation,
    build_middle_school_explanation,
    build_upper_primary_explanation,
    compose_response,
    enhance_with_chat_model,
    normalize_learning_context,
    retrieve_teaching_knowledge,
    route_stage,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.state import (
    TeachingAssistantState,
)


def build_teaching_assistant_graph(
    chat_model: ChatModel | None = None,
    search_knowledge: SearchKnowledgeUseCase | None = None,
    rag_candidate_count: int = 20,
    rag_top_k: int = 5,
) -> CompiledStateGraph:
    """构建“上下文标准化 -> RAG -> 学段分支 -> 互动 -> 回答”的教学图。"""
    builder = StateGraph(TeachingAssistantState)

    async def retrieve(state: TeachingAssistantState) -> dict[str, Any]:
        # 检索用例和数量限制由容器注入，节点本身不创建数据库或模型客户端。
        return await retrieve_teaching_knowledge(
            state,
            search_knowledge,
            rag_candidate_count,
            rag_top_k,
        )

    async def enhance(state: TeachingAssistantState) -> dict[str, Any]:
        # 闭包把由容器注入的模型适配器交给LangGraph节点。
        return await enhance_with_chat_model(state, chat_model)

    builder.add_node("normalize_learning_context", normalize_learning_context)
    builder.add_node("retrieve_teaching_knowledge", retrieve)
    builder.add_node("build_lower_primary_explanation", build_lower_primary_explanation)
    builder.add_node("build_upper_primary_explanation", build_upper_primary_explanation)
    builder.add_node("build_middle_school_explanation", build_middle_school_explanation)
    builder.add_node("build_high_school_explanation", build_high_school_explanation)
    builder.add_node("build_interaction", build_interaction)
    builder.add_node("enhance_with_chat_model", enhance)
    builder.add_node("compose_response", compose_response)

    builder.add_edge(START, "normalize_learning_context")
    builder.add_edge("normalize_learning_context", "retrieve_teaching_knowledge")
    builder.add_conditional_edges(
        "retrieve_teaching_knowledge",
        route_stage,
        {
            "lower_primary": "build_lower_primary_explanation",
            "upper_primary": "build_upper_primary_explanation",
            "middle_school": "build_middle_school_explanation",
            "high_school": "build_high_school_explanation",
        },
    )

    for explanation_node in (
        "build_lower_primary_explanation",
        "build_upper_primary_explanation",
        "build_middle_school_explanation",
        "build_high_school_explanation",
    ):
        builder.add_edge(explanation_node, "build_interaction")

    builder.add_edge("build_interaction", "enhance_with_chat_model")
    builder.add_edge("enhance_with_chat_model", "compose_response")
    builder.add_edge("compose_response", END)
    return builder.compile(name="k12-teaching-assistant")
