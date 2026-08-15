from dataclasses import dataclass
from uuid import uuid4

from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
)
from k12_agent_runtime.domain.sandbox.ports import CodeSandbox


class SandboxDisabledError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class ExecuteCodeCommand:
    code: str
    timeout_seconds: int = 10
    packages: tuple[str, ...] = ()


class ExecuteCodeUseCase:
    def __init__(self, sandbox: CodeSandbox) -> None:
        self._sandbox = sandbox

    async def execute(self, command: ExecuteCodeCommand) -> CodeExecutionResult:
        request = CodeExecutionRequest(
            execution_id=str(uuid4()),
            code=command.code,
            timeout_seconds=command.timeout_seconds,
            packages=command.packages,
        )
        return await self._sandbox.execute(request)
