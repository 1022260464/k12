import asyncio
from dataclasses import replace

import pytest

from k12_agent_runtime.application.agents.run_agent import (
    AgentContractError,
    AgentExecutionError,
    AgentInputError,
    RunAgentCommand,
    RunAgentUseCase,
)
from k12_agent_runtime.domain.agents.models import (
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.infrastructure.agents.registry import (
    DuplicateAgentCodeError,
    InMemoryAgentRegistry,
)


class StubAgent:
    code = "stub"
    description = "Agent contract test double"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=run_input.agent_code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=run_input.input_text,
        )


class BrokenAgent(StubAgent):
    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        raise RuntimeError("provider secret must not reach the API response")


class WrongContractAgent(StubAgent):
    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        result = await super().invoke(run_input)
        return replace(result, run_id="another-run")


def test_use_case_normalizes_input_and_preserves_run_id() -> None:
    use_case = RunAgentUseCase(InMemoryAgentRegistry([StubAgent()]))

    result = asyncio.run(
        use_case.execute(
            RunAgentCommand(
                run_id="run-1",
                agent_code=" stub ",
                input_text="  explain fractions  ",
            )
        )
    )

    assert result.run_id == "run-1"
    assert result.agent_code == "stub"
    assert result.output_text == "explain fractions"


def test_use_case_rejects_blank_input() -> None:
    use_case = RunAgentUseCase(InMemoryAgentRegistry([StubAgent()]))

    with pytest.raises(AgentInputError, match="input_text"):
        asyncio.run(
            use_case.execute(RunAgentCommand(agent_code="stub", input_text="   "))
        )


def test_use_case_wraps_internal_agent_errors() -> None:
    use_case = RunAgentUseCase(InMemoryAgentRegistry([BrokenAgent()]))

    with pytest.raises(AgentExecutionError) as raised:
        asyncio.run(use_case.execute(RunAgentCommand(agent_code="stub", input_text="test")))

    assert isinstance(raised.value.__cause__, RuntimeError)
    assert "provider secret" not in str(raised.value)


def test_use_case_rejects_result_with_wrong_run_id() -> None:
    use_case = RunAgentUseCase(InMemoryAgentRegistry([WrongContractAgent()]))

    with pytest.raises(AgentContractError, match="run_id"):
        asyncio.run(use_case.execute(RunAgentCommand(agent_code="stub", input_text="test")))


def test_registry_rejects_duplicate_agent_code() -> None:
    with pytest.raises(DuplicateAgentCodeError, match="Duplicate agent code"):
        InMemoryAgentRegistry([StubAgent(), StubAgent()])
