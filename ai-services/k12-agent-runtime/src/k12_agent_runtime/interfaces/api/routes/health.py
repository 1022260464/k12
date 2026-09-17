from fastapi import APIRouter, Request

from k12_agent_runtime.interfaces.api.dependencies import get_container
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel, ApiResponse

router = APIRouter(tags=["health"])


class HealthResponse(ApiModel):
    service: str
    status: str
    environment: str
    rabbitmq_enabled: bool
    sandbox_enabled: bool
    mongodb_enabled: bool
    minio_enabled: bool
    redis_enabled: bool


@router.get("/health", response_model=ApiResponse[HealthResponse])
async def health(request: Request) -> ApiResponse[HealthResponse]:
    settings = get_container(request).settings
    return ApiResponse[HealthResponse].ok(
        HealthResponse(
            service=settings.app_name,
            status="UP",
            environment=settings.environment,
            rabbitmq_enabled=settings.rabbitmq_enabled,
            sandbox_enabled=settings.sandbox_enabled,
            mongodb_enabled=settings.mongodb_enabled,
            minio_enabled=settings.minio_enabled,
            redis_enabled=settings.redis_enabled,
        )
    )
