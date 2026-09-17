import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.sandbox.execute_code import (
    ExecuteCodeCommand,
    SandboxDisabledError,
    SandboxUnavailableError,
)
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse
from k12_agent_runtime.interfaces.api.schemas.sandbox import (
    CodeExecutionRequest,
    CodeExecutionResponse,
    SandboxCapabilitiesResponse,
)

router = APIRouter(
    prefix="/sandbox",
    tags=["sandbox"],
    dependencies=[Depends(verify_internal_api_key)],
)
logger = logging.getLogger(__name__)


@router.get(
    "/capabilities",
    response_model=ApiResponse[SandboxCapabilitiesResponse],
)
async def capabilities(request: Request) -> ApiResponse[SandboxCapabilitiesResponse]:
    settings = get_container(request).settings
    enabled = settings.sandbox_enabled
    timeout_seconds = settings.sandbox_timeout_seconds
    configured_providers = {
        settings.sandbox_provider.strip().lower(),
        settings.sandbox_fallback_provider.strip().lower(),
    }
    if enabled and "local_piston" in configured_providers:
        timeout_seconds = min(timeout_seconds, settings.piston_run_timeout_ms // 1000)
    execution_mode = settings.sandbox_provider if enabled else "disabled"
    fallback_provider = settings.sandbox_fallback_provider.strip()
    if enabled and fallback_provider:
        execution_mode = f"{execution_mode}->{fallback_provider}"
    return ApiResponse[SandboxCapabilitiesResponse].ok(
        SandboxCapabilitiesResponse(
            enabled=enabled,
            execution_mode=execution_mode,
            supported_languages=["python"],
            limits={
                "timeoutSeconds": timeout_seconds,
                "network": "disabled",
                "filesystem": "ephemeral",
                "maxOutputBytes": settings.sandbox_max_output_bytes,
            },
        )
    )


@router.post(
    "/executions",
    response_model=ApiResponse[CodeExecutionResponse],
)
async def execute_code(
    body: CodeExecutionRequest,
    request: Request,
) -> ApiResponse[CodeExecutionResponse] | JSONResponse:
    use_case = get_container(request).execute_code
    try:
        result = await use_case.execute(
            ExecuteCodeCommand(
                code=body.code,
                timeout_seconds=body.timeout_seconds,
                packages=tuple(body.packages),
            )
        )
    except SandboxDisabledError as error:
        response = ApiResponse[CodeExecutionResponse](
            code=503,
            message=str(error),
            data=None,
        )
        return JSONResponse(
            status_code=503,
            content=response.model_dump(mode="json", by_alias=True),
        )
    except SandboxUnavailableError as error:
        logger.error("Sandbox provider unavailable", exc_info=error)
        response = ApiResponse[CodeExecutionResponse](
            code=503,
            message="代码执行服务暂不可用",
            data=None,
        )
        return JSONResponse(
            status_code=503,
            content=response.model_dump(mode="json", by_alias=True),
        )

    return ApiResponse[CodeExecutionResponse].ok(
        CodeExecutionResponse.from_domain(result)
    )
