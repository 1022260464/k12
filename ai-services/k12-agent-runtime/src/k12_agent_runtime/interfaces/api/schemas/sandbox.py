from typing import Any

from pydantic import Field

from k12_agent_runtime.domain.sandbox.models import CodeExecutionResult
from k12_agent_runtime.interfaces.api.schemas.agents import ArtifactResponse
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel


class SandboxCapabilitiesResponse(ApiModel):
    enabled: bool
    execution_mode: str
    supported_languages: list[str]
    limits: dict[str, Any]


class CodeExecutionRequest(ApiModel):
    code: str = Field(min_length=1, max_length=100_000)
    timeout_seconds: int = Field(default=10, ge=1, le=30)
    packages: list[str] = Field(default_factory=list, max_length=20)


class CodeExecutionResponse(ApiModel):
    execution_id: str
    status: str
    stdout: str
    stderr: str
    artifacts: list[ArtifactResponse]

    @classmethod
    def from_domain(cls, result: CodeExecutionResult) -> "CodeExecutionResponse":
        return cls(
            execution_id=result.execution_id,
            status=result.status.value,
            stdout=result.stdout,
            stderr=result.stderr,
            artifacts=[ArtifactResponse.from_domain(item) for item in result.artifacts],
        )
