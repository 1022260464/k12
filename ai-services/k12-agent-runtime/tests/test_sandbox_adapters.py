import asyncio
import base64
import json
from threading import Event
from types import SimpleNamespace

import httpx
import pytest

from k12_agent_runtime.application.sandbox import (
    ExecuteCodeCommand,
    ExecuteCodeUseCase,
    SandboxExecutionUncertainError,
    SandboxUnavailableError,
)
from k12_agent_runtime.application.storage import StoreObjectUseCase
from k12_agent_runtime.domain.sandbox import (
    CodeExecutionRequest,
    CodeExecutionResult,
    CodeExecutionStatus,
)
from k12_agent_runtime.domain.storage import StoredObject
from k12_agent_runtime.infrastructure.messaging.messages import CodeExecutionTaskMessage
from k12_agent_runtime.infrastructure.sandbox import (
    FailoverCodeSandbox,
    PistonCodeSandbox,
    TencentAgentSandboxAdapter,
)
from k12_agent_runtime.infrastructure.sandbox._limits import SandboxCapacity
from k12_agent_runtime.interfaces.api.schemas.sandbox import (
    CodeExecutionRequest as ApiCodeExecutionRequest,
)


def test_tencent_adapter_executes_without_network_and_releases_instance() -> None:
    sandbox = _FakeTencentSandbox()

    def create_sandbox(**kwargs):
        assert kwargs["template"] == "k12-python-analysis-v1"
        assert kwargs["allow_internet_access"] is False
        assert kwargs["domain"] == "ap-guangzhou.tencentags.com"
        assert kwargs["request_timeout"] == 15
        assert kwargs["metadata"]["k12ExecutionId"] == "execution-1"
        return sandbox

    adapter = TencentAgentSandboxAdapter(
        domain="ap-guangzhou.tencentags.com",
        api_key="e2b_0000000000000000000000000000000000000000",
        template="k12-python-analysis-v1",
        provider_request_timeout_seconds=15,
        instance_timeout_seconds=120,
        max_timeout_seconds=30,
        max_output_bytes=1024,
        max_result_items=20,
        max_artifacts=5,
        max_artifact_bytes=1024,
        max_concurrency=2,
        store_object=StoreObjectUseCase(None, 1024),
        sandbox_factory=create_sandbox,
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.SUCCEEDED
    assert result.stdout == "hello k12\n"
    assert result.provider_request_id == "sandbox-test-1"
    assert result.artifacts[0].payload == {
        "provider": "tencent_agsx",
        "results": [{"text": "42", "json": {"answer": 42}}],
    }
    assert sandbox.killed is True


def test_piston_adapter_normalizes_success_response() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "http://127.0.0.1:2000/api/v2/execute"
        body = json.loads(request.content)
        assert body["language"] == "python"
        assert body["version"] == "3.12.0"
        assert body["run_timeout"] == 3000
        return httpx.Response(
            200,
            json={
                "run": {
                    "stdout": "hello piston\n",
                    "stderr": "",
                    "code": 0,
                    "signal": None,
                    "cpu_time": 0.01,
                    "wall_time": 20,
                    "memory": 4096,
                }
            },
        )

    adapter = PistonCodeSandbox(
        base_url="http://127.0.0.1:2000",
        python_version="3.12.0",
        connect_timeout_seconds=1,
        max_timeout_seconds=30,
        run_timeout_ms=3000,
        max_output_bytes=1024,
        max_concurrency=1,
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.SUCCEEDED
    assert result.stdout == "hello piston\n"
    assert result.exit_code == 0
    assert result.duration_ms == 20
    assert result.artifacts[0].payload["provider"] == "local_piston"


def test_tencent_adapter_rejects_when_local_capacity_is_full() -> None:
    entered = Event()
    release = Event()
    instances: list[_FakeTencentSandbox] = []

    class BlockingSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            entered.set()
            assert release.wait(timeout=2)
            return super().run_code(code, **kwargs)

    def create_sandbox(**_kwargs):
        sandbox = BlockingSandbox()
        instances.append(sandbox)
        return sandbox

    adapter = _cloud_adapter(create_sandbox, max_concurrency=1, queue_wait_seconds=0.02)

    async def run_pair():
        first = asyncio.create_task(adapter.execute(_request()))
        try:
            assert await asyncio.to_thread(entered.wait, 1)
            rejected = await adapter.execute(_request())
        finally:
            release.set()
        return rejected, await first

    rejected, completed = asyncio.run(run_pair())

    assert rejected.status is CodeExecutionStatus.REJECTED
    assert rejected.stderr == "沙箱繁忙，请稍后再试"
    assert completed.status is CodeExecutionStatus.SUCCEEDED
    assert len(instances) == 1
    assert instances[0].killed is True


def test_piston_adapter_rejects_without_sending_second_request() -> None:
    calls = 0

    async def run_pair():
        entered = asyncio.Event()
        release = asyncio.Event()

        async def handler(_request):
            nonlocal calls
            calls += 1
            entered.set()
            await release.wait()
            return httpx.Response(200, json={"run": {"stdout": "ok", "code": 0}})

        adapter = PistonCodeSandbox(
            base_url="http://127.0.0.1:2000",
            python_version="3.12.0",
            connect_timeout_seconds=1,
            max_timeout_seconds=30,
            run_timeout_ms=3000,
            max_output_bytes=1024,
            max_concurrency=1,
            max_waiters=0,
            queue_wait_seconds=1,
            transport=httpx.MockTransport(handler),
        )
        first = asyncio.create_task(adapter.execute(_request()))
        try:
            await asyncio.wait_for(entered.wait(), timeout=1)
            rejected = await adapter.execute(_request())
        finally:
            release.set()
        return rejected, await first

    rejected, completed = asyncio.run(run_pair())

    assert rejected.status is CodeExecutionStatus.REJECTED
    assert rejected.stderr == "沙箱繁忙，请稍后再试"
    assert completed.status is CodeExecutionStatus.SUCCEEDED
    assert calls == 1


def test_capacity_bounds_waiters_and_releases_slot() -> None:
    async def scenario():
        capacity = SandboxCapacity(max_concurrency=1, max_waiters=1, wait_seconds=1)
        assert await capacity.acquire()
        waiter = asyncio.create_task(capacity.acquire())
        await asyncio.sleep(0.01)
        assert await capacity.acquire() is False
        capacity.release()
        assert await waiter is True
        capacity.release()
        assert await capacity.acquire() is True
        capacity.release()

    asyncio.run(scenario())


def test_execution_use_case_rejects_runtime_package_installation() -> None:
    use_case = ExecuteCodeUseCase(_NeverCalledSandbox())

    with pytest.raises(ValueError, match="不能在请求中临时安装依赖"):
        asyncio.run(
            use_case.execute(
                ExecuteCodeCommand(
                    code="print('test')",
                    packages=("requests",),
                )
            )
        )


def test_code_execution_defaults_allow_cloud_interpreter_startup() -> None:
    assert ExecuteCodeCommand(code="print(1)").timeout_seconds == 30
    assert ApiCodeExecutionRequest(code="print(1)").timeout_seconds == 30
    assert CodeExecutionTaskMessage(run_id="run-1", code="print(1)").timeout_seconds == 30


def test_failover_uses_fallback_only_when_primary_is_unavailable() -> None:
    primary = _StubSandbox(error=SandboxUnavailableError("cloud unavailable"))
    fallback_result = _result(CodeExecutionStatus.SUCCEEDED)
    fallback = _StubSandbox(result=fallback_result)
    adapter = FailoverCodeSandbox(
        primary=primary,
        fallback=fallback,
        primary_name="tencent_agsx",
        fallback_name="local_piston",
        cooldown_seconds=60,
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result is fallback_result
    assert primary.calls == 1
    assert fallback.calls == 1


def test_failover_does_not_repeat_failed_user_code() -> None:
    failed_result = _result(CodeExecutionStatus.FAILED)
    primary = _StubSandbox(result=failed_result)
    fallback = _NeverCalledSandbox()
    adapter = FailoverCodeSandbox(
        primary=primary,
        fallback=fallback,
        primary_name="tencent_agsx",
        fallback_name="local_piston",
        cooldown_seconds=60,
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result is failed_result
    assert primary.calls == 1


def test_failover_does_not_retry_busy_primary_on_fallback() -> None:
    rejected = _result(CodeExecutionStatus.REJECTED)
    primary = _StubSandbox(result=rejected)
    fallback = _NeverCalledSandbox()

    result = asyncio.run(_failover(primary, fallback).execute(_request()))

    assert result is rejected
    assert primary.calls == 1


def test_failover_skips_primary_during_cooldown() -> None:
    now = [100.0]
    primary = _StubSandbox(error=SandboxUnavailableError("cloud unavailable"))
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = FailoverCodeSandbox(
        primary=primary,
        fallback=fallback,
        primary_name="tencent_agsx",
        fallback_name="local_piston",
        cooldown_seconds=60,
        clock=lambda: now[0],
    )

    asyncio.run(adapter.execute(_request()))
    now[0] = 120.0
    asyncio.run(adapter.execute(_request()))

    assert primary.calls == 1
    assert fallback.calls == 2


def test_cloud_creation_failure_can_fall_back() -> None:
    def fail_create(**_kwargs):
        raise OSError("control plane unavailable")

    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(_cloud_adapter(fail_create), fallback)

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.SUCCEEDED
    assert fallback.calls == 1


def test_cloud_run_failure_does_not_replay_code_and_releases_instance() -> None:
    class FailedSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            raise OSError("connection lost after submitting code")

    sandbox = FailedSandbox()
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(_cloud_adapter(lambda **_kwargs: sandbox), fallback)

    with pytest.raises(SandboxExecutionUncertainError):
        asyncio.run(adapter.execute(_request()))

    assert sandbox.killed is True
    assert fallback.calls == 0


def test_cloud_artifact_storage_failure_does_not_replay_code() -> None:
    class ArtifactSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            execution = super().run_code(code, **kwargs)
            execution.results[0].png = base64.b64encode(b"image").decode("ascii")
            return execution

    sandbox = ArtifactSandbox()
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(_cloud_adapter(lambda **_kwargs: sandbox), fallback)

    with pytest.raises(SandboxExecutionUncertainError):
        asyncio.run(adapter.execute(_request()))

    assert sandbox.killed is True
    assert fallback.calls == 0


def test_cloud_code_timeout_is_terminal_and_does_not_fall_back() -> None:
    class TimeoutException(Exception):
        pass

    class SlowSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            raise TimeoutException("code timeout")

    sandbox = SlowSandbox()
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(_cloud_adapter(lambda **_kwargs: sandbox), fallback)

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.TIMED_OUT
    assert sandbox.killed is True
    assert fallback.calls == 0


@pytest.mark.parametrize("limit", ["bytes", "files", "results"])
def test_cloud_oversized_results_are_rejected_without_storage_or_replay(limit) -> None:
    class LargeResultSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            execution = super().run_code(code, **kwargs)
            result = execution.results[0]
            if limit == "bytes":
                result.png = base64.b64encode(b"x" * 1025).decode("ascii")
            elif limit == "files":
                result.png = base64.b64encode(b"x").decode("ascii")
                result.jpeg = base64.b64encode(b"y").decode("ascii")
            else:
                execution.results.append(result)
            return execution

    sandbox = LargeResultSandbox()
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(
        _cloud_adapter(
            lambda **_kwargs: sandbox,
            max_result_items=1,
            max_artifacts=1,
            max_artifact_bytes=1024,
        ),
        fallback,
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.REJECTED
    assert result.artifacts == ()
    assert sandbox.killed is True
    assert fallback.calls == 0


def test_cloud_output_flood_is_rejected_without_artifact_upload() -> None:
    class FloodSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            execution = super().run_code(code, **kwargs)
            execution.logs.stdout = ["x" * 2048]
            execution.results[0].png = base64.b64encode(b"image").decode("ascii")
            return execution

    sandbox = FloodSandbox()
    fallback = _StubSandbox(result=_result(CodeExecutionStatus.SUCCEEDED))
    adapter = _failover(_cloud_adapter(lambda **_kwargs: sandbox), fallback)

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.REJECTED
    assert len(result.stdout.encode("utf-8")) <= 1024
    assert result.artifacts == ()
    assert sandbox.killed is True
    assert fallback.calls == 0


def test_cloud_artifact_at_exact_size_limit_is_stored() -> None:
    class ArtifactSandbox(_FakeTencentSandbox):
        def run_code(self, code, **kwargs):
            execution = super().run_code(code, **kwargs)
            execution.results[0].png = base64.b64encode(b"x" * 1024).decode("ascii")
            return execution

    class Storage:
        uploaded_size = None

        async def put(self, *, object_key, stream, size_bytes, content_type):
            self.uploaded_size = size_bytes
            assert stream.read() == b"x" * 1024
            return StoredObject(
                bucket="k12-artifacts",
                object_key=object_key,
                uri=f"s3://k12-artifacts/{object_key}",
                size_bytes=size_bytes,
                content_type=content_type,
            )

    storage = Storage()
    sandbox = ArtifactSandbox()
    adapter = _cloud_adapter(
        lambda **_kwargs: sandbox,
        store_object=StoreObjectUseCase(storage, 1024),
    )

    result = asyncio.run(adapter.execute(_request()))

    assert result.status is CodeExecutionStatus.SUCCEEDED
    assert storage.uploaded_size == 1024
    assert result.artifacts[1].uri.startswith("s3://k12-artifacts/sandbox-results/")
    assert sandbox.killed is True


def _cloud_adapter(
    factory,
    *,
    max_result_items=20,
    max_artifacts=5,
    max_artifact_bytes=1024,
    store_object=None,
    max_concurrency=2,
    queue_wait_seconds=3.0,
):
    return TencentAgentSandboxAdapter(
        domain="ap-guangzhou.tencentags.com",
        api_key="e2b_0000000000000000000000000000000000000000",
        template="k12-python-analysis-v1",
        provider_request_timeout_seconds=15,
        instance_timeout_seconds=120,
        max_timeout_seconds=30,
        max_output_bytes=1024,
        max_result_items=max_result_items,
        max_artifacts=max_artifacts,
        max_artifact_bytes=max_artifact_bytes,
        max_concurrency=max_concurrency,
        queue_wait_seconds=queue_wait_seconds,
        store_object=store_object or StoreObjectUseCase(None, 1024),
        sandbox_factory=factory,
    )


def _failover(primary, fallback):
    return FailoverCodeSandbox(
        primary=primary,
        fallback=fallback,
        primary_name="tencent_agsx",
        fallback_name="local_piston",
        cooldown_seconds=60,
    )


def _request() -> CodeExecutionRequest:
    return CodeExecutionRequest(
        execution_id="execution-1",
        code="print('hello')",
        timeout_seconds=10,
    )


def _result(status: CodeExecutionStatus) -> CodeExecutionResult:
    return CodeExecutionResult(execution_id="execution-1", status=status)


class _FakeTencentSandbox:
    sandbox_id = "sandbox-test-1"

    def __init__(self) -> None:
        self.killed = False

    def run_code(self, code, **kwargs):
        assert code == "print('hello')"
        assert kwargs["language"] == "python"
        return SimpleNamespace(
            logs=SimpleNamespace(stdout=["hello k12\n"], stderr=[]),
            error=None,
            results=[
                SimpleNamespace(
                    text="42",
                    markdown=None,
                    json={"answer": 42},
                    chart=None,
                    png=None,
                    jpeg=None,
                    pdf=None,
                )
            ],
        )

    def kill(self):
        self.killed = True


class _NeverCalledSandbox:
    async def execute(self, _request):
        raise AssertionError("包含临时依赖的请求不应进入沙箱")


class _StubSandbox:
    def __init__(self, *, result=None, error=None) -> None:
        self._result = result
        self._error = error
        self.calls = 0

    async def execute(self, _request):
        self.calls += 1
        if self._error is not None:
            raise self._error
        return self._result
