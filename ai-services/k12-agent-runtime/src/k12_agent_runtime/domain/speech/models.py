from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SynthesizedSpeech:
    content: bytes
    content_type: str
    model: str
    voice: str
