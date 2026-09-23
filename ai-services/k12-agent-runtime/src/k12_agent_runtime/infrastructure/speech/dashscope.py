from urllib.parse import urlparse

import httpx

from k12_agent_runtime.domain.speech import SynthesizedSpeech


class SpeechProviderError(RuntimeError):
    pass


class DashScopeSpeechSynthesizer:
    """调用百炼语音合成并下载短期音频，避免把供应商地址暴露给浏览器。"""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        voice: str,
        timeout_seconds: float,
        max_audio_bytes: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._voice = voice
        self._timeout_seconds = timeout_seconds
        self._max_audio_bytes = max_audio_bytes
        self._transport = transport

    async def synthesize(self, text: str) -> SynthesizedSpeech:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "input": {
                "text": text,
                "voice": self._voice,
                "format": "mp3",
                "sample_rate": 24_000,
            },
        }
        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout, transport=self._transport) as client:
                response = await client.post(self._base_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                audio_url = self._trusted_audio_url(self._audio_url(data))
                audio_response = await client.get(audio_url)
                audio_response.raise_for_status()
        except (httpx.HTTPError, ValueError, TypeError) as error:
            raise SpeechProviderError("百炼语音服务调用失败") from error

        content = audio_response.content
        if not content:
            raise SpeechProviderError("百炼语音服务返回了空音频")
        if len(content) > self._max_audio_bytes:
            raise SpeechProviderError("百炼语音服务返回的音频超过大小限制")
        content_type = audio_response.headers.get("content-type", "audio/mpeg").split(";", 1)[0]
        if not content_type.startswith("audio/"):
            raise SpeechProviderError("百炼语音服务返回了非音频内容")
        return SynthesizedSpeech(
            content=content,
            content_type=content_type,
            model=self._model,
            voice=self._voice,
        )

    @staticmethod
    def _audio_url(data: object) -> str:
        if not isinstance(data, dict):
            raise ValueError("invalid provider response")
        output = data.get("output")
        if not isinstance(output, dict):
            raise ValueError("missing output")
        audio = output.get("audio")
        if isinstance(audio, dict) and isinstance(audio.get("url"), str):
            return audio["url"]
        if isinstance(output.get("audio_url"), str):
            return output["audio_url"]
        raise ValueError("missing audio url")

    @staticmethod
    def _trusted_audio_url(audio_url: str) -> str:
        parsed = urlparse(audio_url)
        hostname = (parsed.hostname or "").lower()
        if parsed.scheme not in {"http", "https"} or not (
            hostname == "aliyuncs.com" or hostname.endswith(".aliyuncs.com")
        ):
            raise ValueError("untrusted audio url")
        # 百炼旧接口可能返回HTTP OSS地址；下载前强制升级为HTTPS。
        return parsed._replace(scheme="https").geturl()
