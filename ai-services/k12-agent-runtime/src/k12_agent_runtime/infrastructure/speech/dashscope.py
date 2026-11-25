import base64
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


class DashScopeSpeechRecognizer:
    """调用百炼qwen3-asr识别语音；格式由文件头嗅探，避免跨服务转发请求头。"""

    _SUPPORTED_FORMATS = ("wav", "mp3", "aac", "m4a", "3gp", "amr")

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def recognize(self, audio: bytes) -> "RecognizedTranscript":
        from k12_agent_runtime.domain.speech import RecognizedTranscript

        audio_format = self._sniff_audio_format(audio)
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        # 必须包成data URI：纯base64若以"//"开头会被DashScope当成URL。
        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": f"data:audio/{audio_format};base64,"
                                + base64.b64encode(audio).decode("ascii"),
                                "format": audio_format,
                            },
                        }
                    ],
                }
            ],
        }
        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout, transport=self._transport) as client:
                response = await client.post(self._base_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError, TypeError) as error:
            raise SpeechProviderError("百炼语音识别服务调用失败") from error
        text = self._extract_text(data)
        return RecognizedTranscript(text=text, model=self._model)

    @classmethod
    def _sniff_audio_format(cls, audio: bytes) -> str:
        if len(audio) < 12:
            raise ValueError("语音数据太短，无法识别")
        head = audio[:16]
        if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
            return "wav"
        if head[:3] == b"ID3":
            return "mp3"
        # 0xFFE是MP3帧同步；0xFFF开头且layer=00才是ADTS(AAC)，如0xF1/0xF9。
        if head[0] == 0xFF and head[1] & 0xE0 == 0xE0 and head[1] not in (0xF0, 0xF1, 0xF8, 0xF9):
            return "mp3"
        if head[0] == 0xFF and head[1] in (0xF0, 0xF1, 0xF8, 0xF9):
            return "aac"
        if head[4:8] == b"ftyp":
            return "m4a"
        if head[:4] in (b"OggS", b"fLaC") or head[:4] == b"\x1aE\xdf\xa3":
            raise ValueError("暂不支持该音频格式，请使用wav或mp3录音")
        raise ValueError("无法识别的音频格式，请使用wav或mp3录音")

    @staticmethod
    def _extract_text(data: object) -> str:
        if not isinstance(data, dict):
            raise SpeechProviderError("百炼语音识别返回了异常数据")
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise SpeechProviderError("百炼语音识别返回了空结果")
        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        text = message.get("content") if isinstance(message, dict) else None
        if not isinstance(text, str):
            raise SpeechProviderError("百炼语音识别返回了异常数据")
        return " ".join(text.split())
