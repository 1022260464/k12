"""Offline load probe for the per-process sandbox admission limit.

This script never contacts Tencent Cloud, Piston, Java, or a database.
"""

import argparse
import asyncio
from math import ceil
from time import perf_counter

from k12_agent_runtime.infrastructure.sandbox._limits import SandboxCapacity


def _percentile(values: list[float], percent: int) -> float:
    ordered = sorted(values)
    return ordered[max(0, ceil(len(ordered) * percent / 100) - 1)]


async def _run(args: argparse.Namespace) -> int:
    capacity = SandboxCapacity(
        max_concurrency=args.max_concurrency,
        max_waiters=args.max_waiters,
        wait_seconds=args.wait_ms / 1000,
    )
    clients = asyncio.Semaphore(args.clients)
    accepted_ms: list[float] = []
    rejected_ms: list[float] = []
    active = 0
    peak_active = 0

    async def request() -> None:
        nonlocal active, peak_active
        async with clients:
            started = perf_counter()
            if not await capacity.acquire():
                rejected_ms.append((perf_counter() - started) * 1000)
                return
            active += 1
            peak_active = max(peak_active, active)
            try:
                await asyncio.sleep(args.work_ms / 1000)
            finally:
                active -= 1
                capacity.release()
            accepted_ms.append((perf_counter() - started) * 1000)

    started = perf_counter()
    await asyncio.gather(*(request() for _ in range(args.requests)))
    elapsed_ms = (perf_counter() - started) * 1000

    # A fresh request after the burst must still acquire a slot.
    reusable = await capacity.acquire()
    if reusable:
        capacity.release()

    print("OFFLINE ONLY: no cloud, Piston, Java, or database calls")
    print(f"requests={args.requests} clients={args.clients} elapsed={elapsed_ms:.1f}ms")
    print(
        f"accepted={len(accepted_ms)} rejected={len(rejected_ms)} "
        f"peak_active={peak_active}/{args.max_concurrency}"
    )
    if accepted_ms:
        print(
            f"accepted_latency p50={_percentile(accepted_ms, 50):.1f}ms "
            f"p95={_percentile(accepted_ms, 95):.1f}ms"
        )
    if rejected_ms:
        print(f"rejected_latency p95={_percentile(rejected_ms, 95):.1f}ms")

    healthy = (
        len(accepted_ms) + len(rejected_ms) == args.requests
        and bool(accepted_ms)
        and peak_active <= args.max_concurrency
        and active == 0
        and reusable
    )
    print("result=" + ("PASS" if healthy else "FAIL"))
    return 0 if healthy else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requests", type=int, default=40)
    parser.add_argument("--clients", type=int, default=16)
    parser.add_argument("--work-ms", type=int, default=200)
    parser.add_argument("--wait-ms", type=int, default=100)
    parser.add_argument("--max-concurrency", type=int, default=2)
    parser.add_argument("--max-waiters", type=int, default=4)
    args = parser.parse_args()

    if not 1 <= args.requests <= 1000 or not 1 <= args.clients <= 100:
        parser.error("requests须为1-1000，clients须为1-100")
    if not 1 <= args.max_concurrency <= 4 or not 0 <= args.max_waiters <= 8:
        parser.error("max-concurrency须为1-4，max-waiters须为0-8")
    if not 1 <= args.work_ms <= 5000 or not 1 <= args.wait_ms <= 5000:
        parser.error("work-ms和wait-ms须为1-5000")

    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
