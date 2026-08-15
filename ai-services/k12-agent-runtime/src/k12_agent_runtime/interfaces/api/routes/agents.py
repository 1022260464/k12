from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.agents.run_agent import (
    AgentNotFoundError,
    RunAgentCommand,
)
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.agents import (
    AgentInfoResponse,
    AgentInvokeRequest,
    AgentRunResponse,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse

router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("", response_model=ApiResponse[list[AgentInfoResponse]])
async def list_agents(request: Request) -> ApiResponse[list[AgentInfoResponse]]:
    registry = get_container(request).agent_registry
    data = [
        AgentInfoResponse(code=agent.code, description=agent.description)
        for agent in registry.list()
    ]
    return ApiResponse[list[AgentInfoResponse]].ok(data)


@router.post(
    "/{agent_code}/invoke",
    response_model=ApiResponse[AgentRunResponse],
)
async def invoke_agent(
    agent_code: str,
    body: AgentInvokeRequest,
    request: Request,
) -> ApiResponse[AgentRunResponse] | JSONResponse:
    use_case = get_container(request).run_agent
    try:
        result = await use_case.execute(
            RunAgentCommand(
                agent_code=agent_code,
                input_text=body.input_text,
                user_id=body.user_id,
                context=body.context,
            )
        )
    except AgentNotFoundError as error:
        response = ApiResponse[AgentRunResponse](
            code=404,
            message=str(error),
            data=None,
        )
        return JSONResponse(
            status_code=404,
            content=response.model_dump(mode="json", by_alias=True),
        )

    return ApiResponse[AgentRunResponse].ok(AgentRunResponse.from_domain(result))
