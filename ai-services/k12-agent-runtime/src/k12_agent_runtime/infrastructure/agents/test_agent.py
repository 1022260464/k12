from k12_agent_runtime.domain.agents import AgentExecutor
from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)

class TestAgent(AgentExecutor):

    @property
    def code(self) -> str:
        return super().code

    @property
    def description(self) -> str:
        return super().description

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        return await super().invoke(run_input)
