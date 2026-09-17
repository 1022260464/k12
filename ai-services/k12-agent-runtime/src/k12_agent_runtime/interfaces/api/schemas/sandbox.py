from typing import Any

from pydantic import Field, field_validator

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
    timeout_seconds: int = Field(default=30, ge=1, le=30)
    packages: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("code")
    @classmethod
    def code_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("code不能为空")
        return value

    @field_validator("packages")
    @classmethod
    def packages_must_be_preinstalled(cls, value: list[str]) -> list[str]:
        if value:
            raise ValueError("不能临时安装依赖，请使用已审核的沙箱镜像")
        return value


class CodeExecutionResponse(ApiModel):
    execution_id: str
    status: str
    stdout: str
    stderr: str
    artifacts: list[ArtifactResponse]
    exit_code: int | None
    duration_ms: int | None
    provider_request_id: str | None

    @classmethod
    def from_domain(cls, result: CodeExecutionResult) -> "CodeExecutionResponse":
        return cls(
            execution_id=result.execution_id,
            status=result.status.value,
            stdout=result.stdout,
            stderr=result.stderr,
            artifacts=[ArtifactResponse.from_domain(item) for item in result.artifacts],
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
            provider_request_id=result.provider_request_id,
        )
