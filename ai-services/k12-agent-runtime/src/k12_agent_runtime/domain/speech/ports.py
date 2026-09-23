from typing import Protocol

from k12_agent_runtime.domain.speech.models import SynthesizedSpeech


class SpeechSynthesizer(Protocol):
    async def synthesize(self, text: str) -> SynthesizedSpeech: ...
