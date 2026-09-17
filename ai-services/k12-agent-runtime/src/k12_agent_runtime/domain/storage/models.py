from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class StoredObject:
    bucket: str
    object_key: str
    uri: str
    size_bytes: int
    content_type: str
    etag: str | None = None
