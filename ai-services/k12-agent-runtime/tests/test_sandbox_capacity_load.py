import asyncio

import pytest
from pydantic import ValidationError

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.sandbox._limits import SandboxCapacity


@pytest.mark.parametrize(
    ("field", "invalid"),
    [
        ("sandbox_max_concurrency", 0),
        ("sandbox_max_concurrency", 5),
        ("sandbox_max_waiters", -1),
        ("sandbox_max_waiters", 9),
        ("sandbox_queue_wait_seconds", 0),
        ("sandbox_queue_wait_seconds", 5.1),
    ],
)
def test_capacity_settings_reject_values_outside_demo_range(
    field: str, invalid: int | float
) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: invalid})


def test_burst_respects_execution_and_waiting_capacity() -> None:
    async def scenario() -> None:
        capacity = SandboxCapacity(max_concurrency=2, max_waiters=4, wait_seconds=1)
        release = asyncio.Event()
        all_started = asyncio.Event()
        started = 0
        active = 0
        peak_active = 0

        async def request() -> bool:
            nonlocal started, active, peak_active
            started += 1
            if started == 50:
                all_started.set()
            if not await capacity.acquire():
                return False
            active += 1
            peak_active = max(active, peak_active)
            try:
                await release.wait()
                await asyncio.sleep(0)
                return True
            finally:
                active -= 1
                capacity.release()

        requests = [asyncio.create_task(request()) for _ in range(50)]
        await asyncio.wait_for(all_started.wait(), timeout=1)
        release.set()
        results = await asyncio.wait_for(asyncio.gather(*requests), timeout=2)

        assert results.count(True) == 6
        assert results.count(False) == 44
        assert peak_active <= 2
        assert active == 0
        assert await capacity.acquire() is True
        capacity.release()

    asyncio.run(scenario())
