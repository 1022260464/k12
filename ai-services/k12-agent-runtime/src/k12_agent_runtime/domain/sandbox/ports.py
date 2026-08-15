from typing import Protocol

from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
)


class CodeSandbox(Protocol):
    """Execution port; implementations must isolate untrusted Python code."""

    async def execute(self, request: CodeExecutionRequest) -> CodeExecutionResult: ...
