from typing import Any, NotRequired, TypedDict

from k12_agent_runtime.domain.agents.models import AgentRunInput


class TeachingAssistantState(TypedDict):
    """Teaching Assistant 的 LangGraph 共享状态。

    `run_input` 是图的原始入口，其余字段由不同节点逐步补充。把中间状态显式列出，便于以后
    将确定性节点替换成模型、RAG 或工具节点时继续复用同一条工作流。
    """

    run_input: AgentRunInput
    stage: NotRequired[str]
    grade: NotRequired[str]
    textbook: NotRequired[str]
    chapter: NotRequired[str]
    topic: NotRequired[str]
    topic_code: NotRequired[str | None]
    topic_hint: NotRequired[str | None]
    weak_points: NotRequired[list[str]]
    interests: NotRequired[list[str]]
    preferred_interactions: NotRequired[list[str]]
    recent_learning_history: NotRequired[list[dict[str, Any]]]
    recent_performance: NotRequired[list[dict[str, Any]]]
    recent_practice: NotRequired[list[dict[str, Any]]]
    mastery_percent: NotRequired[int | None]
    personalization: NotRequired[dict[str, str]]
    knowledge_graph: NotRequired[dict[str, Any]]
    conversation_history: NotRequired[list[dict[str, str]]]
    conversation: NotRequired[dict[str, Any]]
    intent_mode: NotRequired[str]
    off_topic_strike_count: NotRequired[int]
    knowledge_snippets: NotRequired[list[dict[str, Any]]]
    rag_candidate_count: NotRequired[int]
    rag_retrieved: NotRequired[bool]
    rag_fallback_reason: NotRequired[str]
    strategy: NotRequired[str]
    explanation: NotRequired[str]
    example: NotRequired[str]
    learning_goal: NotRequired[str]
    understanding_check: NotRequired[str]
    next_step: NotRequired[str]
    model_used: NotRequired[bool]
    model_name: NotRequired[str]
    model_usage: NotRequired[dict[str, Any]]
    model_fallback_reason: NotRequired[str]
    dynamic_error_reason: NotRequired[str]
    omit_demo: NotRequired[bool]
    animation_payload: NotRequired[dict[str, Any] | None]
    quiz_payload: NotRequired[dict[str, Any] | None]
    output_text: NotRequired[str]
    metadata: NotRequired[dict[str, Any]]
