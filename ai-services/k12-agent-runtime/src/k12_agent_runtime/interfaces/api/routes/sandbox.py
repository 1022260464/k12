from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.sandbox.execute_code import (
    ExecuteCodeCommand,
    SandboxDisabledError,
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


@router.get(
    "/capabilities",
    response_model=ApiResponse[SandboxCapabilitiesResponse],
)
async def capabilities(request: Request) -> ApiResponse[SandboxCapabilitiesResponse]:
    enabled = get_container(request).settings.sandbox_enabled
    return ApiResponse[SandboxCapabilitiesResponse].ok(
        SandboxCapabilitiesResponse(
            enabled=enabled,
            execution_mode="isolated-worker" if enabled else "disabled",
            supported_languages=["python"],
            limits={
                "timeoutSeconds": 30,
                "network": "disabled",
                "filesystem": "ephemeral",
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

    return ApiResponse[CodeExecutionResponse].ok(
        CodeExecutionResponse.from_domain(result)
    )
