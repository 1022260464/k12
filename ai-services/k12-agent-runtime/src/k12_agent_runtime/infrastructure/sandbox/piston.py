from time import perf_counter
from typing import Any

import httpx

from k12_agent_runtime.application.sandbox.execute_code import SandboxUnavailableError
from k12_agent_runtime.domain.agents.models import AgentArtifact, AgentArtifactKind
from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
    CodeExecutionStatus,
)
from k12_agent_runtime.infrastructure.sandbox._limits import SandboxCapacity, limit_outputs


class PistonCodeSandbox:
    """本地开发适配器。Piston必须运行在独立Docker容器，不能暴露到公网。"""

    def __init__(
        self,
        *,
        base_url: str,
        python_version: str,
        connect_timeout_seconds: float,
        max_timeout_seconds: int,
        run_timeout_ms: int,
        max_output_bytes: int,
        max_concurrency: int,
        max_waiters: int = 4,
        queue_wait_seconds: float = 3.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._python_version = python_version
        self._connect_timeout_seconds = connect_timeout_seconds
        self._max_timeout_seconds = max_timeout_seconds
        self._run_timeout_ms = run_timeout_ms
        self._max_output_bytes = max_output_bytes
        self._capacity = SandboxCapacity(max_concurrency, max_waiters, queue_wait_seconds)
        self._transport = transport

    async def execute(self, request: CodeExecutionRequest) -> CodeExecutionResult:
        if request.timeout_seconds > self._max_timeout_seconds:
            return _rejected(request, "执行时间超过平台限制")

        payload = {
            "language": "python",
            "version": self._python_version,
            "files": [{"name": "main.py", "content": request.code}],
            "stdin": "",
            # Piston部署自身还有更严格的上限，K12不能提交超过服务端限制的请求。
            "run_timeout": min(request.timeout_seconds * 1000, self._run_timeout_ms),
            "run_memory_limit": 268_435_456,
        }
        started = perf_counter()
        timeout = httpx.Timeout(
            connect=self._connect_timeout_seconds,
            read=request.timeout_seconds + 5,
            write=5,
            pool=self._connect_timeout_seconds,
        )
        if not await self._capacity.acquire():
            return _rejected(request, "沙箱繁忙，请稍后再试")
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    f"{self._base_url}/api/v2/execute",
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException:
            return CodeExecutionResult(
                execution_id=request.execution_id,
                status=CodeExecutionStatus.TIMED_OUT,
                stderr="代码执行超时",
                duration_ms=int((perf_counter() - started) * 1000),
            )
        except (httpx.HTTPError, OSError) as exc:
            raise SandboxUnavailableError("Piston服务不可用") from exc
        finally:
            self._capacity.release()

        try:
            body: dict[str, Any] = response.json()
            run = body["run"]
            stdout = str(run.get("stdout") or "")
            stderr = str(run.get("stderr") or "")
            exit_code = run.get("code")
            if exit_code is not None:
                exit_code = int(exit_code)
        except (KeyError, TypeError, ValueError) as exc:
            raise SandboxUnavailableError("Piston返回了无效响应") from exc

        stdout, stderr, output_limited = limit_outputs(
            stdout,
            stderr,
            self._max_output_bytes,
        )
        provider_timed_out = run.get("status") == "TO"
        if provider_timed_out and not stderr:
            stderr = str(run.get("message") or "代码执行超时")
        status = (
            CodeExecutionStatus.REJECTED
            if output_limited
            else CodeExecutionStatus.TIMED_OUT
            if provider_timed_out
            else CodeExecutionStatus.SUCCEEDED
            if exit_code == 0
            else CodeExecutionStatus.FAILED
        )
        duration_ms = _duration_ms(run, started)
        artifact = AgentArtifact(
            artifact_id=f"{request.execution_id}-result",
            kind=AgentArtifactKind.CODE_RESULT,
            mime_type="application/vnd.k12.code-result.v1+json",
            title="Python运行结果",
            payload={
                "provider": "local_piston",
                "exitCode": exit_code,
                "signal": run.get("signal"),
                "cpuTime": run.get("cpu_time"),
                "wallTime": run.get("wall_time"),
                "memoryBytes": run.get("memory"),
                "outputTruncated": output_limited,
            },
        )
        return CodeExecutionResult(
            execution_id=request.execution_id,
            status=status,
            stdout=stdout,
            stderr=stderr,
            artifacts=(artifact,),
            exit_code=exit_code,
            duration_ms=duration_ms,
            provider_request_id=request.execution_id,
        )


def _duration_ms(run: dict[str, Any], started: float) -> int:
    try:
        return max(0, int(float(run["wall_time"])))
    except (KeyError, TypeError, ValueError):
        return int((perf_counter() - started) * 1000)


def _rejected(request: CodeExecutionRequest, message: str) -> CodeExecutionResult:
    return CodeExecutionResult(
        execution_id=request.execution_id,
        status=CodeExecutionStatus.REJECTED,
        stderr=message,
    )
