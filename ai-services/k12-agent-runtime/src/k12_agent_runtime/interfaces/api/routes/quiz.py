from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import Field

from k12_agent_runtime.interfaces.api.dependencies import get_container, verify_internal_api_key
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel, ApiResponse

router = APIRouter(
    prefix="/quiz",
    tags=["quiz"],
    dependencies=[Depends(verify_internal_api_key)],
)


class QuizGenerationRequest(ApiModel):
    topic: str = Field(min_length=1, max_length=200)
    stage: str = Field(default="lower_primary", max_length=32)
    count: int = Field(default=5, ge=3, le=8)
    source_text: str | None = Field(default=None, max_length=4000)


@router.post("/generate", response_model=ApiResponse[dict])
async def generate(request: Request, command: QuizGenerationRequest) -> ApiResponse[dict] | JSONResponse:
    """学生端 AI 组题：按主题/课文即时出题，无需教师发布。"""
    try:
        document = await get_container(request).generate_quiz.execute(
            command.topic,
            stage=command.stage,
            count=command.count,
            source_text=command.source_text,
        )
    except ValueError as error:
        return _error(422, str(error))
    return ApiResponse[dict].ok(document)


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ApiResponse[object].fail(status_code, message).model_dump(mode="json", by_alias=True),
    )
