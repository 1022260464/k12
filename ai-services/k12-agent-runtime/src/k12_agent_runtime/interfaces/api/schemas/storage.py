from k12_agent_runtime.domain.storage import StoredObject
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel


class StorageCapabilitiesResponse(ApiModel):
    enabled: bool
    bucket: str
    max_upload_bytes: int
    presigned_ttl_seconds: int


class StoredObjectResponse(ApiModel):
    bucket: str
    object_key: str
    uri: str
    size_bytes: int
    content_type: str
    etag: str | None = None

    @classmethod
    def from_domain(cls, value: StoredObject) -> "StoredObjectResponse":
        return cls(
            bucket=value.bucket,
            object_key=value.object_key,
            uri=value.uri,
            size_bytes=value.size_bytes,
            content_type=value.content_type,
            etag=value.etag,
        )


class DownloadUrlResponse(ApiModel):
    object_key: str
    url: str
    expires_seconds: int
