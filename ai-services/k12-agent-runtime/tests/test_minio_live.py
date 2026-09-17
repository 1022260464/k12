"""Opt-in MinIO integration check. Never run against shared storage by default."""

import asyncio
import os
from io import BytesIO
from uuid import uuid4

import httpx
import pytest

from k12_agent_runtime.application.storage import (
    CreateDownloadUrlUseCase,
    StoreObjectCommand,
    StoreObjectUseCase,
)
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.storage.minio_storage import MinioObjectStorage


@pytest.mark.skipif(
    os.getenv("K12_RUN_LIVE_MINIO_TEST") != "1",
    reason="Set K12_RUN_LIVE_MINIO_TEST=1 to use configured MinIO",
)
def test_real_minio_upload_presign_download_and_cleanup() -> None:
    asyncio.run(_verify_minio_round_trip())


async def _verify_minio_round_trip() -> None:
    settings = Settings()
    assert settings.minio_enabled, "启用真实测试前请配置K12_AGENT_MINIO_ENABLED=true"
    assert settings.minio_access_key and settings.minio_secret_key, "MinIO凭证未配置"

    storage = MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key.get_secret_value(),
        secret_key=settings.minio_secret_key.get_secret_value(),
        bucket=settings.minio_bucket,
        secure=settings.minio_secure,
        region=settings.minio_region,
        connect_timeout_seconds=settings.minio_connect_timeout_seconds,
    )
    payload = f"k12-minio-check-{uuid4()}".encode("ascii")
    stored = await StoreObjectUseCase(storage, settings.minio_max_upload_bytes).execute(
        StoreObjectCommand(
            filename="round-trip.txt",
            content_type="text/plain",
            size_bytes=len(payload),
            stream=BytesIO(payload),
            folder="integration-checks",
        )
    )
    try:
        url = await CreateDownloadUrlUseCase(storage, settings.minio_presigned_ttl_seconds).execute(
            stored.object_key
        )
        try:
            async with httpx.AsyncClient(trust_env=False, timeout=10) as client:
                response = await client.get(url)
        except httpx.HTTPError:
            raise AssertionError("无法通过签名地址下载测试对象") from None
        assert response.status_code == 200, f"签名地址返回HTTP {response.status_code}"
        assert response.content == payload, "下载内容与上传内容不一致"
    finally:
        await storage.delete(stored.object_key)
