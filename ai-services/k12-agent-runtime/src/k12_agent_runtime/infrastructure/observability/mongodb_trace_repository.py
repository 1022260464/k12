import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from k12_agent_runtime.core.redaction import redact_mapping
from k12_agent_runtime.domain.agents.models import AgentRunInput, AgentRunResult


class MongoAgentTraceRepository:
    """使用MongoDB保存结构可能变化的Agent输入、输出和执行元数据。"""

    def __init__(
        self,
        *,
        url: str,
        database: str,
        collection: str,
        connect_timeout_ms: int,
        retention_days: int,
    ) -> None:
        from pymongo import AsyncMongoClient

        self._client: Any = AsyncMongoClient(
            url,
            serverSelectionTimeoutMS=connect_timeout_ms,
            connectTimeoutMS=connect_timeout_ms,
            tz_aware=True,
        )
        self._collection = self._client[database][collection]
        self._retention_days = retention_days
        self._indexes_ready = False
        self._index_lock = asyncio.Lock()

    async def record_started(self, run_input: AgentRunInput) -> None:
        await self._ensure_indexes()
        now = datetime.now(UTC)
        await self._collection.update_one(
            {"run_id": run_input.run_id},
            {
                "$setOnInsert": {
                    "run_id": run_input.run_id,
                    "created_at": now,
                    "expires_at": now + timedelta(days=self._retention_days),
                },
                "$set": {
                    "agent_code": run_input.agent_code,
                    "user_id": run_input.user_id,
                    "input_text": run_input.input_text[:20_000],
                    "context": redact_mapping(run_input.context),
                    "status": "RUNNING",
                    "started_at": now,
                    "updated_at": now,
                },
            },
            upsert=True,
        )

    async def record_succeeded(
        self,
        run_input: AgentRunInput,
        result: AgentRunResult,
    ) -> None:
        await self._ensure_indexes()
        now = datetime.now(UTC)
        await self._collection.update_one(
            {"run_id": run_input.run_id},
            {
                "$set": {
                    "status": result.status.value,
                    "output_text": result.output_text[:50_000],
                    "output_metadata": redact_mapping(result.metadata),
                    "artifact_ids": [item.artifact_id for item in result.artifacts],
                    "finished_at": now,
                    "updated_at": now,
                }
            },
            upsert=False,
        )

    async def record_failed(self, run_input: AgentRunInput, error_type: str) -> None:
        await self._ensure_indexes()
        now = datetime.now(UTC)
        await self._collection.update_one(
            {"run_id": run_input.run_id},
            {
                "$set": {
                    "status": "FAILED",
                    "error_type": error_type[:255],
                    "finished_at": now,
                    "updated_at": now,
                }
            },
            upsert=False,
        )

    async def close(self) -> None:
        await self._client.close()

    async def _ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        async with self._index_lock:
            if self._indexes_ready:
                return
            await self._client.admin.command("ping")
            await self._collection.create_index("run_id", unique=True)
            await self._collection.create_index([("user_id", 1), ("created_at", -1)])
            await self._collection.create_index([("agent_code", 1), ("created_at", -1)])
            await self._collection.create_index("expires_at", expireAfterSeconds=0)
            self._indexes_ready = True
