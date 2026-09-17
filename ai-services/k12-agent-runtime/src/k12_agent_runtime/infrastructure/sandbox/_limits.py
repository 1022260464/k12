import asyncio


class SandboxCapacity:
    """限制单进程同时执行数和等待人数；调用方负责在执行后释放名额。"""

    def __init__(self, max_concurrency: int, max_waiters: int, wait_seconds: float) -> None:
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._max_waiters = max_waiters
        self._wait_seconds = wait_seconds
        self._waiting = 0

    async def acquire(self) -> bool:
        if self._semaphore.locked():
            if self._waiting >= self._max_waiters:
                return False
            self._waiting += 1
            try:
                try:
                    await asyncio.wait_for(self._semaphore.acquire(), timeout=self._wait_seconds)
                except TimeoutError:
                    return False
            finally:
                self._waiting -= 1
            return True
        await self._semaphore.acquire()
        return True

    def release(self) -> None:
        self._semaphore.release()


def limit_outputs(stdout: str, stderr: str, max_bytes: int) -> tuple[str, str, bool]:
    """按UTF-8字节限制对外输出，避免日志洪泛占满Runtime或HTTP响应。"""
    if len(stdout.encode("utf-8")) + len(stderr.encode("utf-8")) <= max_bytes:
        return stdout, stderr, False

    stdout_budget = min(max_bytes * 3 // 4, max_bytes)
    limited_stdout = _truncate_utf8(stdout, stdout_budget)
    used = len(limited_stdout.encode("utf-8"))
    limited_stderr = _truncate_utf8(stderr, max(max_bytes - used, 0))
    return limited_stdout, limited_stderr, True


def _truncate_utf8(value: str, max_bytes: int) -> str:
    if max_bytes <= 0:
        return ""
    raw = value.encode("utf-8")
    if len(raw) <= max_bytes:
        return value
    marker = "\n...[输出已截断]"
    marker_bytes = marker.encode("utf-8")
    if max_bytes <= len(marker_bytes):
        return raw[:max_bytes].decode("utf-8", errors="ignore")
    body = raw[: max_bytes - len(marker_bytes)].decode("utf-8", errors="ignore")
    return body + marker
