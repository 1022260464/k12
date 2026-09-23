from pydantic import Field

from k12_agent_runtime.interfaces.api.schemas.common import ApiModel


class SpeechSynthesisRequest(ApiModel):
    text: str = Field(min_length=1, max_length=4_000)


class SpeechCapabilitiesResponse(ApiModel):
    enabled: bool
    provider: str
    model: str
    voice: str
    max_text_chars: int
