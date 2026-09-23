from k12_agent_runtime.domain.speech import SpeechSynthesizer, SynthesizedSpeech


class SpeechSynthesisDisabledError(RuntimeError):
    pass


class SynthesizeSpeechUseCase:
    def __init__(
        self,
        synthesizer: SpeechSynthesizer | None,
        max_text_chars: int,
    ) -> None:
        self._synthesizer = synthesizer
        self._max_text_chars = max_text_chars

    async def execute(self, text: str) -> SynthesizedSpeech:
        normalized = " ".join(text.split())
        if not normalized:
            raise ValueError("朗读文本不能为空")
        if len(normalized) > self._max_text_chars:
            raise ValueError(f"单次朗读文本不能超过{self._max_text_chars}个字符")
        if self._synthesizer is None:
            raise SpeechSynthesisDisabledError("云语音合成尚未启用")
        return await self._synthesizer.synthesize(normalized)
