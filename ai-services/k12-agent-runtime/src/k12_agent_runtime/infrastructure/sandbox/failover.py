import logging
from collections.abc import Callable
from time import monotonic

from k12_agent_runtime.application.sandbox.execute_code import (
    SandboxExecutionUncertainError,
    SandboxUnavailableError,
)
from k12_agent_runtime.domain.sandbox.models import (
    CodeExecutionRequest,
    CodeExecutionResult,
)
from k12_agent_runtime.domain.sandbox.ports import CodeSandbox

logger = logging.getLogger(__name__)


class FailoverCodeSandbox:
    """主沙箱故障时切换到备用沙箱，并在冷却期内避免反复请求故障服务。"""

    def __init__(
        self,
        *,
        primary: CodeSandbox,
        fallback: CodeSandbox,
        primary_name: str,
        fallback_name: str,
        cooldown_seconds: int,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._primary = primary
        self._fallback = fallback
        self._primary_name = primary_name
        self._fallback_name = fallback_name
        self._cooldown_seconds = cooldown_seconds
        self._clock = clock
        self._retry_primary_after = 0.0

    async def execute(self, request: CodeExecutionRequest) -> CodeExecutionResult:
        now = self._clock()
        if now < self._retry_primary_after:
            logger.info(
                "Sandbox primary provider is cooling down; using fallback provider: %s",
                self._fallback_name,
            )
            return await self._execute_fallback(request)

        try:
            result = await self._primary.execute(request)
            self._retry_primary_after = 0.0
            return result
        except SandboxExecutionUncertainError:
            logger.warning(
                "Sandbox execution outcome uncertain; refusing fallback replay execution_id=%s",
                request.execution_id,
            )
            raise
        except SandboxUnavailableError:
            self._retry_primary_after = now + self._cooldown_seconds
            logger.warning(
                "Sandbox primary provider unavailable; switching from %s to %s for %s seconds",
                self._primary_name,
                self._fallback_name,
                self._cooldown_seconds,
            )
            return await self._execute_fallback(request)

    async def _execute_fallback(
        self,
        request: CodeExecutionRequest,
    ) -> CodeExecutionResult:
        try:
            return await self._fallback.execute(request)
        except SandboxUnavailableError as exc:
            raise SandboxUnavailableError("主沙箱和备用沙箱均不可用") from exc
