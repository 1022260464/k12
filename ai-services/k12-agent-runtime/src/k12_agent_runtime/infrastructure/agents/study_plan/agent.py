from uuid import uuid4

from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.infrastructure.agents.study_plan.graph import (
    build_study_plan_graph,
)
from k12_agent_runtime.infrastructure.agents.study_plan.state import StudyPlanState


class StudyPlanAgent:
    """将LangGraph工作流适配成K12平台统一AgentExecutor。"""

    def __init__(self) -> None:
        # 图结构是固定的，因此在Agent创建时编译一次，不要在每次请求中重复编译。
        self._graph = build_study_plan_graph()

    @property
    def code(self) -> str:
        return "study-plan"

    @property
    def description(self) -> str:
        return "使用LangGraph根据学习主题、年级和薄弱点生成分阶段学习计划。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        """异步执行图，并将最终State转换为平台领域模型。"""
        initial_state: StudyPlanState = {"run_input": run_input}

        # ainvoke从START运行到END，返回图执行完成后的最终State。
        final_state = await self._graph.ainvoke(initial_state)

        table = AgentArtifact(
            artifact_id=str(uuid4()),
            kind=AgentArtifactKind.TABLE,
            mime_type="application/json",
            title=f"{final_state['topic']}学习计划",
            payload=final_state["plan"],
        )

        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=final_state["output_text"],
            artifacts=(table,),
            metadata=final_state["metadata"],
        )
