from k12_agent_runtime.application.sandbox.execute_code import SandboxDisabledError
from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
)


class DisabledCodeSandbox:
    """Safe default that prevents accidental in-process execution of user code."""

    async def execute(self, request: CodeExecutionRequest) -> CodeExecutionResult:
        del request
        raise SandboxDisabledError(
            "Code sandbox is not configured. Never execute submitted code in the API process."
        )
