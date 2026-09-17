from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class AgentRunStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class AgentArtifactKind(StrEnum):
    CHART = "CHART"
    ANIMATION = "ANIMATION"
    GAME = "GAME"
    CODE_RESULT = "CODE_RESULT"
    IMAGE = "IMAGE"
    TABLE = "TABLE"
    TEXT = "TEXT"
    FILE = "FILE"


@dataclass(frozen=True, slots=True)
class AgentArtifact:
    """A frontend-renderable output produced by an agent or sandbox."""

    artifact_id: str
    kind: AgentArtifactKind
    mime_type: str
    title: str | None = None
    uri: str | None = None
    payload: dict[str, Any] | list[Any] | str | None = None


@dataclass(frozen=True, slots=True)
class AgentRunInput:
    run_id: str
    agent_code: str
    input_text: str
    user_id: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AgentRunResult:
    run_id: str
    agent_code: str
    status: AgentRunStatus
    output_text: str
    artifacts: tuple[AgentArtifact, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)
