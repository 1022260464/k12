from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from k12_agent_runtime.domain.agents.models import AgentRunInput, AgentRunResult
from k12_agent_runtime.domain.agents.ports import AgentRegistry


class AgentNotFoundError(LookupError):
    pass


@dataclass(frozen=True, slots=True)
class RunAgentCommand:
    agent_code: str
    input_text: str
    run_id: str | None = None
    user_id: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


class RunAgentUseCase:
    def __init__(self, registry: AgentRegistry) -> None:
        self._registry = registry

    async def execute(self, command: RunAgentCommand) -> AgentRunResult:
        agent = self._registry.get(command.agent_code)
        if agent is None:
            raise AgentNotFoundError(f"Unknown agent: {command.agent_code}")

        run_input = AgentRunInput(
            run_id=command.run_id or str(uuid4()),
            agent_code=command.agent_code,
            input_text=command.input_text,
            user_id=command.user_id,
            context=command.context,
        )
        return await agent.invoke(run_input)
