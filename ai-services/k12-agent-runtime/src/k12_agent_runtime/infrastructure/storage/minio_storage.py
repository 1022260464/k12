import asyncio
from datetime import timedelta
from typing import Any, BinaryIO

from k12_agent_runtime.domain.storage import StoredObject


class ObjectStorageError(RuntimeError):
    """对象存储操作失败时向应用层暴露的稳定异常。"""


class MinioObjectStorage:
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        secure: bool,
        region: str | None,
        connect_timeout_seconds: float,
    ) -> None:
        from minio import Minio
        from urllib3 import PoolManager, Timeout
        from urllib3.util.retry import Retry

        self._client: Any = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
            region=region,
            http_client=PoolManager(
                timeout=Timeout(
                    connect=connect_timeout_seconds,
                    read=connect_timeout_seconds,
                ),
                retries=Retry(total=1),
            ),
        )
        self._bucket = bucket
        self._bucket_ready = False
        self._bucket_lock = asyncio.Lock()

    async def put(
        self,
        *,
        object_key: str,
        stream: BinaryIO,
        size_bytes: int,
        content_type: str,
    ) -> StoredObject:
        await self._ensure_bucket()
        try:
            result = await asyncio.to_thread(
                self._client.put_object,
                self._bucket,
                object_key,
                stream,
                size_bytes,
                content_type=content_type,
            )
        except Exception as exc:  # noqa: BLE001
            raise ObjectStorageError("object_upload_failed") from exc
        return StoredObject(
            bucket=self._bucket,
            object_key=object_key,
            uri=f"s3://{self._bucket}/{object_key}",
            size_bytes=size_bytes,
            content_type=content_type,
            etag=getattr(result, "etag", None),
        )

    async def create_download_url(self, object_key: str, expires_seconds: int) -> str:
        await self._ensure_bucket()
        try:
            return await asyncio.to_thread(
                self._client.presigned_get_object,
                self._bucket,
                object_key,
                expires=timedelta(seconds=expires_seconds),
            )
        except Exception as exc:  # noqa: BLE001
            raise ObjectStorageError("download_url_failed") from exc

    async def delete(self, object_key: str) -> None:
        await self._ensure_bucket()
        try:
            await asyncio.to_thread(self._client.remove_object, self._bucket, object_key)
        except Exception as exc:  # noqa: BLE001
            raise ObjectStorageError("object_delete_failed") from exc

    async def read_bytes(self, object_key: str, max_bytes: int) -> bytes:
        await self._ensure_bucket()

        def read() -> bytes:
            info = self._client.stat_object(self._bucket, object_key)
            if info.size > max_bytes:
                raise ValueError("资料超过入库大小上限")
            response = self._client.get_object(self._bucket, object_key)
            try:
                content = response.read(max_bytes + 1)
            finally:
                response.close()
                response.release_conn()
            if len(content) > max_bytes:
                raise ValueError("资料超过入库大小上限")
            return content

        try:
            return await asyncio.to_thread(read)
        except ValueError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ObjectStorageError("object_read_failed") from exc

    async def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        async with self._bucket_lock:
            if self._bucket_ready:
                return
            try:
                exists = await asyncio.to_thread(
                    self._client.bucket_exists,
                    self._bucket,
                )
                if not exists:
                    await asyncio.to_thread(self._client.make_bucket, self._bucket)
            except Exception as exc:  # noqa: BLE001
                raise ObjectStorageError("object_storage_unavailable") from exc
            self._bucket_ready = True
