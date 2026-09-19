from uuid import uuid4

from k12_agent_runtime.application.rag import SearchKnowledgeUseCase
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

    def __init__(
        self,
        chat_model: ChatModel | None = None,
        search_knowledge: SearchKnowledgeUseCase | None = None,
        rag_candidate_count: int = 20,
        rag_top_k: int = 5,
    ) -> None:
        # 图结构固定，只在容器启动时编译一次。
        self._graph = build_teaching_assistant_graph(
            chat_model,
            search_knowledge,
            rag_candidate_count,
            rag_top_k,
        )

    @property
    def code(self) -> str:
        return "teaching-assistant"

    @property
    def description(self) -> str:
        return "按学段讲解 AI 通识主题，并展示结构化步骤或固定答案的练习。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        initial_state: TeachingAssistantState = {"run_input": run_input}
        final_state = await self._graph.ainvoke(initial_state)

        artifacts: list[AgentArtifact] = []
        if animation := final_state.get("animation_payload"):
            mime_type = (
                "application/vnd.k12.lesson-steps.v1+json"
                if animation.get("animationType") == "lesson-steps"
                else "application/vnd.k12.animation.v1+json"
            )
            artifacts.append(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.ANIMATION,
                    mime_type=mime_type,
                    title=animation["title"],
                    payload=animation,
                )
            )
        if quiz := final_state.get("quiz_payload"):
            artifacts.append(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.GAME,
                    mime_type="application/vnd.k12.quiz.v1+json",
                    title=quiz["title"],
                    payload=quiz,
                )
            )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=final_state["output_text"],
            artifacts=tuple(artifacts),
            metadata=final_state["metadata"],
        )
