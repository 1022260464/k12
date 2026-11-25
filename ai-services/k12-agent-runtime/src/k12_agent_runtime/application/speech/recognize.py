from k12_agent_runtime.domain.speech import SpeechRecognizer, RecognizedTranscript


class SpeechRecognitionDisabledError(RuntimeError):
    pass


class RecognizeSpeechUseCase:
    def __init__(
        self,
        recognizer: SpeechRecognizer | None,
        max_audio_bytes: int,
    ) -> None:
        self._recognizer = recognizer
        self._max_audio_bytes = max_audio_bytes

    async def execute(self, audio: bytes) -> RecognizedTranscript:
        if not audio:
            raise ValueError("语音数据为空")
        if len(audio) > self._max_audio_bytes:
            limit_mb = self._max_audio_bytes // (1024 * 1024)
            raise ValueError(f"单次语音不能超过{limit_mb}MB")
        if self._recognizer is None:
            raise SpeechRecognitionDisabledError("语音识别尚未启用")
        return await self._recognizer.recognize(audio)
