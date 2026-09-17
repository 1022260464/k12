import asyncio
from io import BytesIO

import pytest

from k12_agent_runtime.application.storage import (
    ObjectTooLargeError,
    StoreObjectCommand,
    StoreObjectUseCase,
)
from k12_agent_runtime.domain.storage import StoredObject


class FakeObjectStorage:
    def __init__(self) -> None:
        self.object_key = None

    async def put(self, *, object_key, stream, size_bytes, content_type):
        self.object_key = object_key
        assert stream.read() == b"demo"
        return StoredObject(
            bucket="test",
            object_key=object_key,
            uri=f"s3://test/{object_key}",
            size_bytes=size_bytes,
            content_type=content_type,
        )

    async def create_download_url(self, object_key, expires_seconds):
        return f"https://example.test/{object_key}?expires={expires_seconds}"

    async def delete(self, _object_key):
        return None


def test_store_object_generates_safe_object_key() -> None:
    storage = FakeObjectStorage()
    use_case = StoreObjectUseCase(storage, max_upload_bytes=1024)

    result = asyncio.run(
        use_case.execute(
            StoreObjectCommand(
                filename="../课程 资料.txt",
                content_type="text/plain",
                size_bytes=4,
                stream=BytesIO(b"demo"),
                folder="documents",
            )
        )
    )

    assert result.object_key.startswith("documents/")
    assert ".." not in result.object_key
    assert result.object_key.endswith("-file.txt")


def test_store_object_rejects_file_over_limit() -> None:
    use_case = StoreObjectUseCase(FakeObjectStorage(), max_upload_bytes=3)

    with pytest.raises(ObjectTooLargeError):
        asyncio.run(
            use_case.execute(
                StoreObjectCommand(
                    filename="demo.txt",
                    content_type="text/plain",
                    size_bytes=4,
                    stream=BytesIO(b"demo"),
                )
            )
        )
