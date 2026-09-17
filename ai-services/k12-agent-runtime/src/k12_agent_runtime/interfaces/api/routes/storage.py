from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.storage import (
    ObjectStorageDisabledError,
    ObjectTooLargeError,
    StoreObjectCommand,
)
from k12_agent_runtime.infrastructure.storage.minio_storage import ObjectStorageError
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse
from k12_agent_runtime.interfaces.api.schemas.storage import (
    DownloadUrlResponse,
    StorageCapabilitiesResponse,
    StoredObjectResponse,
)

router = APIRouter(
    prefix="/storage",
    tags=["storage"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("/capabilities", response_model=ApiResponse[StorageCapabilitiesResponse])
async def capabilities(request: Request) -> ApiResponse[StorageCapabilitiesResponse]:
    settings = get_container(request).settings
    return ApiResponse[StorageCapabilitiesResponse].ok(
        StorageCapabilitiesResponse(
            enabled=settings.minio_enabled,
            bucket=settings.minio_bucket,
            max_upload_bytes=settings.minio_max_upload_bytes,
            presigned_ttl_seconds=settings.minio_presigned_ttl_seconds,
        )
    )


@router.post("/objects", response_model=ApiResponse[StoredObjectResponse])
async def upload_object(
    request: Request,
    file: Annotated[UploadFile, File()],
    folder: Annotated[str, Form()] = "uploads",
) -> ApiResponse[StoredObjectResponse] | JSONResponse:
    stream = file.file
    stream.seek(0, 2)
    size_bytes = stream.tell()
    stream.seek(0)
    try:
        result = await get_container(request).store_object.execute(
            StoreObjectCommand(
                filename=file.filename or "file",
                content_type=file.content_type or "application/octet-stream",
                size_bytes=size_bytes,
                stream=stream,
                folder=folder,
            )
        )
    except ObjectTooLargeError as error:
        return _error(413, str(error))
    except ValueError as error:
        return _error(422, str(error))
    except (ObjectStorageDisabledError, ObjectStorageError):
        return _error(503, "MinIO对象存储不可用")
    return ApiResponse[StoredObjectResponse].ok(StoredObjectResponse.from_domain(result))


@router.get("/download-url", response_model=ApiResponse[DownloadUrlResponse])
async def create_download_url(
    request: Request,
    object_key: Annotated[
        str,
        Query(alias="objectKey", min_length=1, max_length=500),
    ],
) -> ApiResponse[DownloadUrlResponse] | JSONResponse:
    container = get_container(request)
    try:
        url = await container.create_download_url.execute(object_key)
    except ValueError as error:
        return _error(422, str(error))
    except (ObjectStorageDisabledError, ObjectStorageError):
        return _error(503, "MinIO对象存储不可用")
    return ApiResponse[DownloadUrlResponse].ok(
        DownloadUrlResponse(
            object_key=object_key,
            url=url,
            expires_seconds=container.settings.minio_presigned_ttl_seconds,
        )
    )


def _error(status_code: int, message: str) -> JSONResponse:
    response = ApiResponse[object].fail(status_code, message)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )
