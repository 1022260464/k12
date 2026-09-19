from typing import BinaryIO, Protocol

from k12_agent_runtime.domain.storage.models import StoredObject


class ObjectStorage(Protocol):
    """图片、音视频和文档等二进制对象的存储端口。"""

    async def put(
        self,
        *,
        object_key: str,
        stream: BinaryIO,
        size_bytes: int,
        content_type: str,
    ) -> StoredObject: ...

    async def create_download_url(self, object_key: str, expires_seconds: int) -> str: ...

    async def delete(self, object_key: str) -> None: ...

    async def read_bytes(self, object_key: str, max_bytes: int) -> bytes: ...
