from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.speech import SpeechSynthesisDisabledError
from k12_agent_runtime.infrastructure.speech import SpeechProviderError
from k12_agent_runtime.interfaces.api.dependencies import get_container, verify_internal_api_key
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse
from k12_agent_runtime.interfaces.api.schemas.speech import (
    SpeechCapabilitiesResponse,
    SpeechSynthesisRequest,
)

router = APIRouter(
    prefix="/speech",
    tags=["speech"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.get("/capabilities", response_model=ApiResponse[SpeechCapabilitiesResponse])
async def capabilities(request: Request) -> ApiResponse[SpeechCapabilitiesResponse]:
    settings = get_container(request).settings
    return ApiResponse[SpeechCapabilitiesResponse].ok(
        SpeechCapabilitiesResponse(
            enabled=settings.tts_enabled,
            provider=settings.tts_provider,
            model=settings.tts_model,
            voice=settings.tts_voice,
            max_text_chars=settings.tts_max_text_chars,
        )
    )


@router.post("/synthesize")
async def synthesize(request: Request, command: SpeechSynthesisRequest) -> Response:
    try:
        result = await get_container(request).synthesize_speech.execute(command.text)
    except ValueError as error:
        return _error(422, str(error))
    except SpeechSynthesisDisabledError as error:
        return _error(503, str(error))
    except SpeechProviderError:
        return _error(502, "云语音服务暂时不可用")
    return Response(
        content=result.content,
        media_type=result.content_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Speech-Model": result.model,
            "X-Speech-Voice": result.voice,
        },
    )


def _error(status_code: int, message: str) -> JSONResponse:
    response = ApiResponse[object].fail(status_code, message)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )
