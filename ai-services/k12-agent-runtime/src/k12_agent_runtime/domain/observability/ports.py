from typing import Protocol

from k12_agent_runtime.domain.agents.models import AgentRunInput, AgentRunResult


class AgentTraceRepository(Protocol):
    """保存Agent执行轨迹；实现失败时不得影响核心业务结果。"""

    async def record_started(self, run_input: AgentRunInput) -> None: ...

    async def record_succeeded(
        self,
        run_input: AgentRunInput,
        result: AgentRunResult,
    ) -> None: ...

    async def record_failed(self, run_input: AgentRunInput, error_type: str) -> None: ...

    async def close(self) -> None: ...
