import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import BinaryIO
from uuid import uuid4

from k12_agent_runtime.domain.storage import ObjectStorage, StoredObject

_SAFE_FOLDER = re.compile(r"^[a-z][a-z0-9-]{0,31}$")
_UNSAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


class ObjectStorageDisabledError(RuntimeError):
    pass


class ObjectTooLargeError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class StoreObjectCommand:
    filename: str
    content_type: str
    size_bytes: int
    stream: BinaryIO
    folder: str = "uploads"


class StoreObjectUseCase:
    def __init__(self, storage: ObjectStorage | None, max_upload_bytes: int) -> None:
        self._storage = storage
        self._max_upload_bytes = max_upload_bytes

    async def execute(self, command: StoreObjectCommand) -> StoredObject:
        if self._storage is None:
            raise ObjectStorageDisabledError("MinIO对象存储尚未启用")
        if command.size_bytes <= 0:
            raise ValueError("上传文件不能为空")
        if command.size_bytes > self._max_upload_bytes:
            raise ObjectTooLargeError(
                f"上传文件不能超过{self._max_upload_bytes // 1_048_576}MB"
            )
        folder = command.folder.strip().lower()
        if not _SAFE_FOLDER.fullmatch(folder):
            raise ValueError("folder只能包含小写字母、数字和连字符")

        filename = command.filename.replace("\\", "/").rsplit("/", 1)[-1]
        suffix = PurePosixPath(filename).suffix[:16]
        stem = filename[: -len(suffix)] if suffix else filename
        safe_stem = _UNSAFE_FILENAME.sub("-", stem).strip(".-") or "file"
        safe_suffix = _UNSAFE_FILENAME.sub("", suffix)
        safe_filename = f"{safe_stem[:100]}{safe_suffix}"
        today = datetime.now(UTC).strftime("%Y/%m/%d")
        object_key = str(
            PurePosixPath(folder) / today / f"{uuid4()}-{safe_filename[:120]}"
        )
        return await self._storage.put(
            object_key=object_key,
            stream=command.stream,
            size_bytes=command.size_bytes,
            content_type=command.content_type or "application/octet-stream",
        )


class CreateDownloadUrlUseCase:
    def __init__(self, storage: ObjectStorage | None, expires_seconds: int) -> None:
        self._storage = storage
        self._expires_seconds = expires_seconds

    async def execute(self, object_key: str) -> str:
        if self._storage is None:
            raise ObjectStorageDisabledError("MinIO对象存储尚未启用")
        normalized = object_key.strip().lstrip("/")
        if not normalized or ".." in PurePosixPath(normalized).parts:
            raise ValueError("objectKey不合法")
        return await self._storage.create_download_url(
            normalized,
            self._expires_seconds,
        )
