from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import Field

from k12_agent_runtime.interfaces.api.dependencies import get_container, verify_internal_api_key
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel, ApiResponse

router = APIRouter(
    prefix="/courseware",
    tags=["courseware"],
    dependencies=[Depends(verify_internal_api_key)],
)


class CoursewareGenerationRequest(ApiModel):
    topic: str = Field(min_length=1, max_length=200)
    stage: str = Field(default="lower_primary", max_length=32)
    slide_count: int = Field(default=6, ge=4, le=10)
    topic_code: str | None = Field(default=None, max_length=120)


@router.post("/generate", response_model=ApiResponse[dict])
async def generate(request: Request, command: CoursewareGenerationRequest) -> ApiResponse[dict] | JSONResponse:
    """管理端「AI课件生成」的内部入口；学生对话内生成走 agent run 的 COURWARE 工件。"""
    try:
        document = await get_container(request).generate_courseware.execute(
            command.topic,
            stage=command.stage,
            slide_count=command.slide_count,
            topic_code=command.topic_code,
        )
    except ValueError as error:
        return _error(422, str(error))
    return ApiResponse[dict].ok(document)


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ApiResponse[object].fail(status_code, message).model_dump(mode="json", by_alias=True),
    )
