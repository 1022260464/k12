import os

import pytest
from fastapi.testclient import TestClient

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.interfaces.api.app import create_app

pytestmark = pytest.mark.skipif(
    os.getenv("K12_RUN_LIVE_TTS_TEST") != "1",
    reason="Set K12_RUN_LIVE_TTS_TEST=1 to call the configured Bailian TTS service",
)


def test_live_speech_endpoint_returns_audio() -> None:
    settings = Settings()
    headers: dict[str, str] = {}
    if settings.internal_api_key:
        headers["X-Internal-Api-Key"] = settings.internal_api_key.get_secret_value()

    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/internal/v1/speech/synthesize",
            headers=headers,
            json={"text": "小智正在为你朗读互动绘本。"},
        )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("audio/")
    assert response.headers["x-speech-model"] == settings.tts_model
    assert response.headers["x-speech-voice"] == settings.tts_voice
    assert len(response.content) > 1024
