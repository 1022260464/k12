import asyncio
import json

import httpx
from fastapi.testclient import TestClient

from k12_agent_runtime.application.speech import SynthesizeSpeechUseCase
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.speech import SynthesizedSpeech
from k12_agent_runtime.infrastructure.speech import DashScopeSpeechSynthesizer
from k12_agent_runtime.interfaces.api.app import create_app


class FakeSpeechSynthesizer:
    def __init__(self) -> None:
        self.text = ""

    async def synthesize(self, text: str) -> SynthesizedSpeech:
        self.text = text
        return SynthesizedSpeech(b"mp3", "audio/mpeg", "test-model", "test-voice")


def test_use_case_normalizes_text() -> None:
    provider = FakeSpeechSynthesizer()
    result = asyncio.run(SynthesizeSpeechUseCase(provider, 100).execute("  你好\n 小智  "))

    assert provider.text == "你好 小智"
    assert result.content == b"mp3"


def test_dashscope_synthesizer_uses_existing_key_and_downloads_audio() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/SpeechSynthesizer"):
            assert request.headers["Authorization"] == "Bearer shared-key"
            body = json.loads(request.content)
            assert body["model"] == "cosyvoice-v3-flash"
            assert body["input"]["voice"] == "longanyang"
            return httpx.Response(
                200,
                json={
                    "output": {
                        "audio": {"url": "http://audio.example.aliyuncs.com/result.mp3"}
                    }
                },
            )
        assert request.url.scheme == "https"
        return httpx.Response(200, content=b"fake-mp3", headers={"Content-Type": "audio/mpeg"})

    provider = DashScopeSpeechSynthesizer(
        base_url="https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
        api_key="shared-key",
        model="cosyvoice-v3-flash",
        voice="longanyang",
        timeout_seconds=10,
        max_audio_bytes=1024,
        transport=httpx.MockTransport(handler),
    )
    result = asyncio.run(provider.synthesize("你好，小智"))

    assert result.content == b"fake-mp3"
    assert result.content_type == "audio/mpeg"


def test_disabled_speech_endpoint_returns_service_unavailable() -> None:
    settings = Settings(_env_file=None, tts_enabled=False)
    with TestClient(create_app(settings)) as client:
        response = client.post("/internal/v1/speech/synthesize", json={"text": "你好"})

    assert response.status_code == 503
    assert response.json()["message"] == "云语音合成尚未启用"
