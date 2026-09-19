from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from k12_agent_runtime.application.rag import SearchKnowledgeUseCase
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.infrastructure.agents.teaching_assistant.dynamic_lesson import (
    generate_grounded_lesson,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.nodes import (
    build_high_school_explanation,
    build_interaction,
    build_lower_primary_explanation,
    build_middle_school_explanation,
    build_upper_primary_explanation,
    compose_off_topic_response,
    compose_recommend_response,
    compose_response,
    compose_unsupported_response,
    enhance_with_chat_model,
    normalize_learning_context,
    retrieve_teaching_knowledge,
    route_dynamic_result,
    route_intent,
    route_topic,
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
    """构建“意图分流 -> RAG/讲解或推荐/拒答”的教学图。"""
    builder = StateGraph(TeachingAssistantState)

    async def retrieve(state: TeachingAssistantState) -> dict[str, Any]:
        return await retrieve_teaching_knowledge(
            state,
            search_knowledge,
            rag_candidate_count,
            rag_top_k,
        )

    async def enhance(state: TeachingAssistantState) -> dict[str, Any]:
        return await enhance_with_chat_model(state, chat_model)

    async def generate(state: TeachingAssistantState) -> dict[str, Any]:
        return await generate_grounded_lesson(state, chat_model)

    builder.add_node("normalize_learning_context", normalize_learning_context)
    builder.add_node("compose_off_topic_response", compose_off_topic_response)
    builder.add_node("retrieve_teaching_knowledge", retrieve)
    builder.add_node("compose_recommend_response", compose_recommend_response)
    builder.add_node("build_lower_primary_explanation", build_lower_primary_explanation)
    builder.add_node("build_upper_primary_explanation", build_upper_primary_explanation)
    builder.add_node("build_middle_school_explanation", build_middle_school_explanation)
    builder.add_node("build_high_school_explanation", build_high_school_explanation)
    builder.add_node("build_interaction", build_interaction)
    builder.add_node("enhance_with_chat_model", enhance)
    builder.add_node("generate_grounded_lesson", generate)
    builder.add_node("compose_response", compose_response)
    builder.add_node("compose_unsupported_response", compose_unsupported_response)

    builder.add_edge(START, "normalize_learning_context")
    builder.add_conditional_edges(
        "normalize_learning_context",
        route_intent,
        {
            "off_topic": "compose_off_topic_response",
            "course_recommend": "retrieve_teaching_knowledge",
            "explain": "retrieve_teaching_knowledge",
        },
    )
    builder.add_edge("compose_off_topic_response", END)
    builder.add_conditional_edges(
        "retrieve_teaching_knowledge",
        _route_after_retrieve,
        {
            "recommend": "compose_recommend_response",
            "lower_primary": "build_lower_primary_explanation",
            "upper_primary": "build_upper_primary_explanation",
            "middle_school": "build_middle_school_explanation",
            "high_school": "build_high_school_explanation",
            "dynamic": "generate_grounded_lesson",
            "unsupported": "compose_unsupported_response",
        },
    )
    builder.add_edge("compose_recommend_response", END)

    for explanation_node in (
        "build_lower_primary_explanation",
        "build_upper_primary_explanation",
        "build_middle_school_explanation",
        "build_high_school_explanation",
    ):
        builder.add_edge(explanation_node, "build_interaction")

    builder.add_edge("build_interaction", "enhance_with_chat_model")
    builder.add_edge("enhance_with_chat_model", "compose_response")
    builder.add_conditional_edges(
        "generate_grounded_lesson",
        route_dynamic_result,
        {
            "composed": "compose_response",
            "unsupported": "compose_unsupported_response",
        },
    )
    builder.add_edge("compose_response", END)
    builder.add_edge("compose_unsupported_response", END)
    return builder.compile(name="k12-teaching-assistant")


def _route_after_retrieve(state: TeachingAssistantState) -> str:
    if state.get("intent_mode") == "COURSE_RECOMMEND":
        return "recommend"
    return route_topic(state)
