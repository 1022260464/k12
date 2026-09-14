from uuid import uuid4

from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.infrastructure.agents.teaching_assistant.graph import (
    build_teaching_assistant_graph,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.state import (
    TeachingAssistantState,
)


class TeachingAssistantAgent:
    """将 AI 通识教学 LangGraph 适配成平台统一 AgentExecutor。"""

    def __init__(self, chat_model: ChatModel | None = None) -> None:
        # 图结构固定，只在容器启动时编译一次。
        self._graph = build_teaching_assistant_graph(chat_model)

    @property
    def code(self) -> str:
        return "teaching-assistant"

    @property
    def description(self) -> str:
        return "根据学段调整 AI 通识讲解方式，并生成安全的交互动画产物。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        initial_state: TeachingAssistantState = {"run_input": run_input}
        final_state = await self._graph.ainvoke(initial_state)

        animation = AgentArtifact(
            artifact_id=str(uuid4()),
            kind=AgentArtifactKind.ANIMATION,
            mime_type="application/vnd.k12.animation.v1+json",
            title=final_state["animation_payload"]["title"],
            payload=final_state["animation_payload"],
        )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=final_state["output_text"],
            artifacts=(animation,),
            metadata=final_state["metadata"],
        )
