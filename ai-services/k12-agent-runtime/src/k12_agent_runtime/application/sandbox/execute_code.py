from dataclasses import dataclass
from uuid import uuid4

from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
)
from k12_agent_runtime.domain.sandbox.ports import CodeSandbox


class SandboxDisabledError(RuntimeError):
    pass


class SandboxUnavailableError(RuntimeError):
    """云端或本地隔离执行服务不可用，响应中不得泄露供应商异常。"""


class SandboxExecutionUncertainError(SandboxUnavailableError):
    """代码可能已执行；禁止切换供应商重放同一个请求。"""


@dataclass(frozen=True, slots=True)
class ExecuteCodeCommand:
    code: str
    timeout_seconds: int = 30
    packages: tuple[str, ...] = ()


class ExecuteCodeUseCase:
    def __init__(self, sandbox: CodeSandbox) -> None:
        self._sandbox = sandbox

    async def execute(self, command: ExecuteCodeCommand) -> CodeExecutionResult:
        if not command.code.strip():
            raise ValueError("code不能为空")
        if len(command.code) > 100_000:
            raise ValueError("code不能超过100000个字符")
        if command.timeout_seconds < 1:
            raise ValueError("执行时间必须大于0秒")
        if command.packages:
            raise ValueError("不能在请求中临时安装依赖，请使用已审核的沙箱镜像")
        request = CodeExecutionRequest(
            execution_id=str(uuid4()),
            code=command.code,
            timeout_seconds=command.timeout_seconds,
            packages=command.packages,
        )
        return await self._sandbox.execute(request)
