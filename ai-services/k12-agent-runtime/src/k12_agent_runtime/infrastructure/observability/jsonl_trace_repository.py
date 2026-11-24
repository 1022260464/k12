import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from k12_agent_runtime.core.redaction import redact_mapping
from k12_agent_runtime.domain.agents.models import AgentRunInput, AgentRunResult


class JsonlAgentTraceRepository:
    """将Agent执行轨迹按天追加到本地JSONL文件。"""

    _file_prefix = "agent-trace-"

    def __init__(
        self,
        *,
        log_dir: Path,
        retention_days: int,
        file_prefix: str = "agent-trace-",
    ) -> None:
        self._log_dir = log_dir
        self._retention_days = retention_days
        self._file_prefix = file_prefix
        self._write_lock = asyncio.Lock()
        self._pruned = False

    async def record_started(self, run_input: AgentRunInput) -> None:
        now = datetime.now(UTC)
        await self._append(
            {
                "event": "STARTED",
                "run_id": run_input.run_id,
                "agent_code": run_input.agent_code,
                "user_id": run_input.user_id,
                "input_text": run_input.input_text[:20_000],
                "context": redact_mapping(run_input.context),
                "status": "RUNNING",
                "occurred_at": now.isoformat(),
                "expires_at": (now + timedelta(days=self._retention_days)).isoformat(),
            }
        )

    async def record_succeeded(
        self,
        run_input: AgentRunInput,
        result: AgentRunResult,
    ) -> None:
        now = datetime.now(UTC)
        await self._append(
            {
                "event": "SUCCEEDED",
                "run_id": run_input.run_id,
                "agent_code": run_input.agent_code,
                "user_id": run_input.user_id,
                "output_text": result.output_text[:50_000],
                "output_metadata": redact_mapping(result.metadata),
                "artifact_ids": [item.artifact_id for item in result.artifacts],
                "status": result.status.value,
                "occurred_at": now.isoformat(),
                "expires_at": (now + timedelta(days=self._retention_days)).isoformat(),
            }
        )

    async def record_failed(self, run_input: AgentRunInput, error_type: str) -> None:
        now = datetime.now(UTC)
        await self._append(
            {
                "event": "FAILED",
                "run_id": run_input.run_id,
                "agent_code": run_input.agent_code,
                "user_id": run_input.user_id,
                "error_type": error_type[:255],
                "status": "FAILED",
                "occurred_at": now.isoformat(),
                "expires_at": (now + timedelta(days=self._retention_days)).isoformat(),
            }
        )

    async def close(self) -> None:
        return None

    async def _append(self, payload: dict[str, Any]) -> None:
        async with self._write_lock:
            await asyncio.to_thread(self._write_event, payload)

    def _write_event(self, payload: dict[str, Any]) -> None:
        self._log_dir.mkdir(parents=True, exist_ok=True)
        if not self._pruned:
            self._prune_expired_files()
            self._pruned = True

        event = {
            "schema_version": 1,
            "event_id": uuid4().hex,
            **payload,
        }
        line = json.dumps(
            event,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        ) + "\n"
        target = self._log_dir / (
            f"{self._file_prefix}{datetime.now(UTC).date().isoformat()}.jsonl"
        )
        data = line.encode("utf-8")
        descriptor = os.open(
            target,
            os.O_APPEND | os.O_CREAT | os.O_WRONLY,
            0o640,
        )
        try:
            written = os.write(descriptor, data)
            if written != len(data):
                raise OSError(f"incomplete JSONL trace write: {written}/{len(data)} bytes")
        finally:
            os.close(descriptor)

    def _prune_expired_files(self) -> None:
        cutoff = datetime.now(UTC).date() - timedelta(days=self._retention_days)
        for path in self._log_dir.glob(f"{self._file_prefix}*.jsonl"):
            date_text = path.stem.removeprefix(self._file_prefix)
            try:
                file_date = datetime.fromisoformat(date_text).date()
            except ValueError:
                continue
            if file_date >= cutoff:
                continue
            try:
                os.remove(path)
            except FileNotFoundError:
                continue
