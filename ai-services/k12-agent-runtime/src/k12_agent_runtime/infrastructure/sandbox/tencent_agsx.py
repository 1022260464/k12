import asyncio
import base64
import binascii
import json
import logging
from collections.abc import Callable
from io import BytesIO
from time import perf_counter
from typing import Any

from k12_agent_runtime.application.sandbox.execute_code import (
    SandboxExecutionUncertainError,
    SandboxUnavailableError,
)
from k12_agent_runtime.application.storage import (
    ObjectStorageDisabledError,
    StoreObjectCommand,
    StoreObjectUseCase,
)
from k12_agent_runtime.domain.agents.models import AgentArtifact, AgentArtifactKind
from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
    CodeExecutionStatus,
)
from k12_agent_runtime.infrastructure.sandbox._limits import SandboxCapacity, limit_outputs

logger = logging.getLogger(__name__)


class _ArtifactLimitExceededError(ValueError):
    pass


class TencentAgentSandboxAdapter:
    """腾讯云AGSX适配器；厂商SDK对象不会进入应用层或HTTP契约。"""

    def __init__(
        self,
        *,
        domain: str,
        api_key: str,
        template: str,
        provider_request_timeout_seconds: float,
        instance_timeout_seconds: int,
        max_timeout_seconds: int,
        max_output_bytes: int,
        max_result_items: int,
        max_artifacts: int,
        max_artifact_bytes: int,
        max_concurrency: int,
        store_object: StoreObjectUseCase,
        max_waiters: int = 4,
        queue_wait_seconds: float = 3.0,
        sandbox_factory: Callable[..., Any] | None = None,
    ) -> None:
        self._domain = domain.strip()
        self._api_key = api_key
        self._template = template.strip()
        self._provider_request_timeout_seconds = provider_request_timeout_seconds
        self._instance_timeout_seconds = instance_timeout_seconds
        self._max_timeout_seconds = max_timeout_seconds
        self._max_output_bytes = max_output_bytes
        self._max_result_items = max_result_items
        self._max_artifacts = max_artifacts
        self._max_artifact_bytes = max_artifact_bytes
        self._store_object = store_object
        self._sandbox_factory = sandbox_factory
        self._capacity = SandboxCapacity(max_concurrency, max_waiters, queue_wait_seconds)

    async def execute(self, request: CodeExecutionRequest) -> CodeExecutionResult:
        if request.timeout_seconds > self._max_timeout_seconds:
            return CodeExecutionResult(
                execution_id=request.execution_id,
                status=CodeExecutionStatus.REJECTED,
                stderr="执行时间超过平台限制",
            )

        if not await self._capacity.acquire():
            return CodeExecutionResult(
                execution_id=request.execution_id,
                status=CodeExecutionStatus.REJECTED,
                stderr="沙箱繁忙，请稍后再试",
            )
        try:
            return await self._execute_isolated(request)
        finally:
            self._capacity.release()

    async def _execute_isolated(self, request: CodeExecutionRequest) -> CodeExecutionResult:
        sandbox: Any = None
        started = perf_counter()
        execution_completed = False
        try:
            sandbox = await asyncio.to_thread(self._create_sandbox, request.execution_id)
            execution = await asyncio.to_thread(
                sandbox.run_code,
                request.code,
                language="python",
                timeout=float(request.timeout_seconds),
                request_timeout=float(request.timeout_seconds + 10),
            )
            execution_completed = True
            stdout = "".join(str(item) for item in (execution.logs.stdout or []))
            stderr = "".join(str(item) for item in (execution.logs.stderr or []))
            if execution.error is not None:
                error_name = str(getattr(execution.error, "name", "ExecutionError"))
                error_value = str(getattr(execution.error, "value", "代码执行失败"))
                stderr = f"{stderr}\n{error_name}: {error_value}".strip()

            stdout, stderr, output_limited = limit_outputs(
                stdout,
                stderr,
                self._max_output_bytes,
            )
            status = (
                CodeExecutionStatus.REJECTED
                if output_limited
                else CodeExecutionStatus.FAILED
                if execution.error is not None
                else CodeExecutionStatus.SUCCEEDED
            )
            artifacts: list[AgentArtifact] = []
            if not output_limited:
                results = execution.results or []
                self._validate_artifact_limits(results)
                artifacts = await self._build_artifacts(request.execution_id, results)
            return CodeExecutionResult(
                execution_id=request.execution_id,
                status=status,
                stdout=stdout,
                stderr=stderr,
                artifacts=tuple(artifacts),
                exit_code=0 if status is CodeExecutionStatus.SUCCEEDED else 1,
                duration_ms=int((perf_counter() - started) * 1000),
                provider_request_id=str(getattr(sandbox, "sandbox_id", "")) or None,
            )
        except Exception as exc:  # noqa: BLE001
            if isinstance(exc, _ArtifactLimitExceededError):
                return CodeExecutionResult(
                    execution_id=request.execution_id,
                    status=CodeExecutionStatus.REJECTED,
                    stderr=str(exc),
                    exit_code=1,
                    duration_ms=int((perf_counter() - started) * 1000),
                    provider_request_id=str(getattr(sandbox, "sandbox_id", "")) or None,
                )
            if _is_timeout_exception(exc) and sandbox is not None and not execution_completed:
                return CodeExecutionResult(
                    execution_id=request.execution_id,
                    status=CodeExecutionStatus.TIMED_OUT,
                    stderr="代码执行超时",
                    duration_ms=int((perf_counter() - started) * 1000),
                    provider_request_id=str(getattr(sandbox, "sandbox_id", "")) or None,
                )
            if sandbox is not None:
                raise SandboxExecutionUncertainError(
                    "腾讯云沙箱执行结果不确定，已禁止备用沙箱重试"
                ) from exc
            if isinstance(exc, SandboxUnavailableError):
                raise
            raise SandboxUnavailableError("腾讯云Agent Sandbox不可用") from exc
        finally:
            if sandbox is not None:
                await self._release_sandbox(sandbox, request.execution_id)

    async def _release_sandbox(self, sandbox: Any, execution_id: str) -> None:
        # kill is safe to retry when the first response is lost; the instance also has a TTL.
        for attempt in range(2):
            try:
                await asyncio.to_thread(sandbox.kill, request_timeout=3.0)
                return
            except Exception:  # noqa: BLE001
                if attempt == 0:
                    logger.warning(
                        "Tencent sandbox release failed; retrying execution_id=%s sandbox_id=%s",
                        execution_id,
                        getattr(sandbox, "sandbox_id", None),
                        exc_info=True,
                    )
                    await asyncio.sleep(0.2)
                else:
                    logger.exception(
                        "Tencent sandbox release failed after retry execution_id=%s sandbox_id=%s",
                        execution_id,
                        getattr(sandbox, "sandbox_id", None),
                    )

    def _create_sandbox(self, execution_id: str) -> Any:
        factory = self._sandbox_factory
        if factory is None:
            from e2b_code_interpreter import Sandbox

            factory = Sandbox.create
        return factory(
            template=self._template,
            timeout=self._instance_timeout_seconds,
            metadata={"k12ExecutionId": execution_id},
            allow_internet_access=False,
            domain=self._domain,
            api_key=self._api_key,
            request_timeout=self._provider_request_timeout_seconds,
        )

    async def _build_artifacts(
        self,
        execution_id: str,
        results: list[Any],
    ) -> list[AgentArtifact]:
        summaries: list[dict[str, Any]] = []
        artifacts: list[AgentArtifact] = []
        image_index = 0
        for result in results:
            summary = _safe_result_summary(result)
            if summary:
                summaries.append(summary)
            for attribute, suffix, content_type in (
                ("png", "png", "image/png"),
                ("jpeg", "jpg", "image/jpeg"),
                ("pdf", "pdf", "application/pdf"),
            ):
                encoded = getattr(result, attribute, None)
                if not encoded:
                    continue
                image_index += 1
                binary = _decode_base64(str(encoded))
                try:
                    stored = await self._store_object.execute(
                        StoreObjectCommand(
                            filename=f"sandbox-result-{image_index}.{suffix}",
                            content_type=content_type,
                            size_bytes=len(binary),
                            stream=BytesIO(binary),
                            folder="sandbox-results",
                        )
                    )
                except ObjectStorageDisabledError as exc:
                    raise SandboxUnavailableError("沙箱产物需要MinIO存储") from exc
                artifacts.append(
                    AgentArtifact(
                        artifact_id=f"{execution_id}-file-{image_index}",
                        kind=(
                            AgentArtifactKind.IMAGE
                            if content_type.startswith("image/")
                            else AgentArtifactKind.FILE
                        ),
                        mime_type=content_type,
                        title=f"代码运行产物 {image_index}",
                        uri=stored.uri,
                    )
                )

        artifacts.insert(
            0,
            AgentArtifact(
                artifact_id=f"{execution_id}-result",
                kind=AgentArtifactKind.CODE_RESULT,
                mime_type="application/vnd.k12.code-result.v1+json",
                title="Python运行结果",
                payload={"provider": "tencent_agsx", "results": summaries},
            ),
        )
        return artifacts

    def _validate_artifact_limits(self, results: list[Any]) -> None:
        if len(results) > self._max_result_items:
            raise _ArtifactLimitExceededError("沙箱返回的结果项超过数量限制")

        count = 0
        total_bytes = 0
        for result in results:
            for attribute in ("png", "jpeg", "pdf"):
                encoded = getattr(result, attribute, None)
                if not encoded:
                    continue
                count += 1
                if count > self._max_artifacts:
                    raise _ArtifactLimitExceededError("沙箱文件产物超过数量限制")
                total_bytes += _base64_size(str(encoded))
                if total_bytes > self._max_artifact_bytes:
                    raise _ArtifactLimitExceededError("沙箱文件产物超过大小限制")


def _safe_result_summary(result: Any) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for name in ("text", "markdown"):
        value = getattr(result, name, None)
        if value is not None:
            limited, _, _ = limit_outputs(str(value), "", 32_768)
            summary[name] = limited
    json_value = getattr(result, "json", None)
    if json_value is not None:
        summary["json"] = _bounded_json(json_value)
    chart = getattr(result, "chart", None)
    if isinstance(chart, dict):
        summary["chart"] = _bounded_json(chart)
    return summary


def _decode_base64(value: str) -> bytes:
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    try:
        return base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise SandboxUnavailableError("沙箱返回了无效文件产物") from exc


def _base64_size(value: str) -> int:
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    padding = 2 if encoded.endswith("==") else 1 if encoded.endswith("=") else 0
    if len(encoded) % 4 == 0:
        return len(encoded) // 4 * 3 - padding
    return (len(encoded) + 3) // 4 * 3


def _is_timeout_exception(error: Exception) -> bool:
    return error.__class__.__name__ == "TimeoutException"


def _bounded_json(value: Any) -> Any:
    try:
        encoded = json.dumps(value, ensure_ascii=False, default=str).encode("utf-8")
    except (TypeError, ValueError):
        return {"omitted": True, "reason": "not_serializable"}
    if len(encoded) > 65_536:
        return {"omitted": True, "reason": "result_too_large"}
    return value
