from dataclasses import dataclass

from k12_agent_runtime.application.agents.run_agent import RunAgentUseCase
from k12_agent_runtime.application.sandbox.execute_code import ExecuteCodeUseCase
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.agents.ports import AgentRegistry
from k12_agent_runtime.infrastructure.agents.demo_chart_agent import DemoChartAgent
from k12_agent_runtime.infrastructure.agents.registry import InMemoryAgentRegistry
from k12_agent_runtime.infrastructure.agents.study_plan import StudyPlanAgent
from k12_agent_runtime.infrastructure.sandbox.disabled import DisabledCodeSandbox


@dataclass(frozen=True, slots=True)
class ApplicationContainer:
    settings: Settings
    agent_registry: AgentRegistry
    run_agent: RunAgentUseCase
    execute_code: ExecuteCodeUseCase


def build_container(settings: Settings) -> ApplicationContainer:
    # 新Agent需要在注册器中登记，接口才能通过agent_code找到它。
    registry = InMemoryAgentRegistry([DemoChartAgent(), StudyPlanAgent()])
    sandbox = DisabledCodeSandbox()
    return ApplicationContainer(
        settings=settings,
        agent_registry=registry,
        run_agent=RunAgentUseCase(registry),
        execute_code=ExecuteCodeUseCase(sandbox),
    )
