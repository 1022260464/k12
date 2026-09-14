from collections.abc import Iterable

from k12_agent_runtime.domain.agents.ports import AgentExecutor


class DuplicateAgentCodeError(ValueError):
    """两个执行器使用同一个 code 时，在服务启动阶段直接失败。"""


class InMemoryAgentRegistry:
    """Registry boundary; replace its contents with real agent adapters later."""

    def __init__(self, agents: Iterable[AgentExecutor]) -> None:
        self._agents: dict[str, AgentExecutor] = {}
        for agent in agents:
            if not isinstance(agent.code, str) or not agent.code.strip():
                raise ValueError("Agent code must not be blank")
            code = agent.code.strip()
            if code in self._agents:
                raise DuplicateAgentCodeError(f"Duplicate agent code: {code}")
            self._agents[code] = agent

    def get(self, agent_code: str) -> AgentExecutor | None:
        return self._agents.get(agent_code)

    def list(self) -> tuple[AgentExecutor, ...]:
        return tuple(self._agents.values())
