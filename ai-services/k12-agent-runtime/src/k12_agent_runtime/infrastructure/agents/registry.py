from collections.abc import Iterable

from k12_agent_runtime.domain.agents.ports import AgentExecutor


class InMemoryAgentRegistry:
    """Registry boundary; replace its contents with real agent adapters later."""

    def __init__(self, agents: Iterable[AgentExecutor]) -> None:
        self._agents = {agent.code: agent for agent in agents}

    def get(self, agent_code: str) -> AgentExecutor | None:
        return self._agents.get(agent_code)

    def list(self) -> tuple[AgentExecutor, ...]:
        return tuple(self._agents.values())
