from typing import Protocol

from k12_agent_runtime.domain.agents.models import AgentRunInput, AgentRunResult


class AgentExecutor(Protocol):
    """Port implemented by LangGraph, an SDK agent, or a local workflow."""

    @property
    def code(self) -> str: ...

    @property
    def description(self) -> str: ...

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult: ...


class AgentRegistry(Protocol):
    def get(self, agent_code: str) -> AgentExecutor | None: ...

    def list(self) -> tuple[AgentExecutor, ...]: ...
