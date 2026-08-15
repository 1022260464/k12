from dataclasses import dataclass
from enum import StrEnum

from k12_agent_runtime.domain.agents.models import AgentArtifact


class CodeExecutionStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class CodeExecutionRequest:
    execution_id: str
    code: str
    timeout_seconds: int
    packages: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CodeExecutionResult:
    execution_id: str
    status: CodeExecutionStatus
    stdout: str = ""
    stderr: str = ""
    artifacts: tuple[AgentArtifact, ...] = ()
