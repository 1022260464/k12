from typing import Protocol

from k12_agent_runtime.domain.speech.models import RecognizedTranscript, SynthesizedSpeech


class SpeechSynthesizer(Protocol):
    async def synthesize(self, text: str) -> SynthesizedSpeech: ...


class SpeechRecognizer(Protocol):
    async def recognize(self, audio: bytes) -> RecognizedTranscript: ...
