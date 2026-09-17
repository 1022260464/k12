from fastapi import APIRouter, Depends, Request

from k12_agent_runtime.application.agents.run_agent import RunAgentCommand
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
) -> ApiResponse[AgentRunResponse]:
    use_case = get_container(request).run_agent
    result = await use_case.execute(
        RunAgentCommand(
            agent_code=agent_code,
            input_text=body.input_text,
            user_id=body.user_id,
            context=body.context,
        )
    )

    return ApiResponse[AgentRunResponse].ok(AgentRunResponse.from_domain(result))
