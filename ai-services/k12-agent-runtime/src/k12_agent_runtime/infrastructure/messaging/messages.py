from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from k12_agent_runtime.domain.agents.models import AgentRunResult
from k12_agent_runtime.domain.sandbox.models import CodeExecutionResult


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class MessageModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class AgentRunTaskMessage(MessageModel):
    run_id: str = Field(min_length=1)
    agent_code: str = Field(min_length=1)
    input_text: str = Field(min_length=1, max_length=20_000)
    user_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)

    @field_validator("run_id", "agent_code", "input_text")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        """拒绝只有空格的消息，让非法任务进入死信队列而不是占用 Worker。"""
        if not value.strip():
            raise ValueError("message field must not be blank")
        return value


class ArtifactMessage(MessageModel):
    artifact_id: str
    kind: str
    mime_type: str
    title: str | None = None
    uri: str | None = None
    payload: dict[str, Any] | list[Any] | str | None = None


class AgentRunResultMessage(MessageModel):
    run_id: str
    agent_code: str
    status: str
    output_text: str
    started_time: datetime | None = None
    artifacts: list[ArtifactMessage] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def started(
        cls,
        task: AgentRunTaskMessage,
        started_time: datetime,
    ) -> "AgentRunResultMessage":
        """Build the event emitted as soon as a worker starts executing a task."""
        return cls(
            run_id=task.run_id,
            agent_code=task.agent_code,
            status="RUNNING",
            output_text="",
            started_time=started_time,
        )

    @classmethod
    def from_domain(
        cls,
        result: AgentRunResult,
        started_time: datetime,
    ) -> "AgentRunResultMessage":
        return cls(
            run_id=result.run_id,
            agent_code=result.agent_code,
            status=result.status.value,
            output_text=result.output_text,
            started_time=started_time,
            artifacts=[
                ArtifactMessage(
                    artifact_id=item.artifact_id,
                    kind=item.kind.value,
                    mime_type=item.mime_type,
                    title=item.title,
                    uri=item.uri,
                    payload=item.payload,
                )
                for item in result.artifacts
            ],
            metadata=result.metadata,
        )

    @classmethod
    def failed(
        cls,
        task: AgentRunTaskMessage,
        message: str,
        started_time: datetime,
    ) -> "AgentRunResultMessage":
        return cls(
            run_id=task.run_id,
            agent_code=task.agent_code,
            status="FAILED",
            output_text=message,
            started_time=started_time,
        )


class CodeExecutionTaskMessage(MessageModel):
    run_id: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=100_000)
    timeout_seconds: int = Field(default=30, ge=1, le=30)
    packages: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("run_id", "code")
    @classmethod
    def code_task_text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message field must not be blank")
        return value

    @field_validator("packages")
    @classmethod
    def code_task_cannot_install_packages(cls, value: list[str]) -> list[str]:
        if value:
            raise ValueError("runtime package installation is not allowed")
        return value


class CodeExecutionResultMessage(MessageModel):
    run_id: str
    execution_id: str | None = None
    status: str
    stdout: str = ""
    stderr: str = ""
    artifacts: list[ArtifactMessage] = Field(default_factory=list)
    exit_code: int | None = None
    duration_ms: int | None = None
    started_time: datetime | None = None

    @classmethod
    def started(
        cls,
        task: CodeExecutionTaskMessage,
        started_time: datetime,
    ) -> "CodeExecutionResultMessage":
        return cls(
            run_id=task.run_id,
            status="RUNNING",
            started_time=started_time,
        )

    @classmethod
    def from_domain(
        cls,
        task: CodeExecutionTaskMessage,
        result: CodeExecutionResult,
        started_time: datetime,
    ) -> "CodeExecutionResultMessage":
        return cls(
            run_id=task.run_id,
            execution_id=result.execution_id,
            status=result.status.value,
            stdout=result.stdout,
            stderr=result.stderr,
            artifacts=[
                ArtifactMessage(
                    artifact_id=item.artifact_id,
                    kind=item.kind.value,
                    mime_type=item.mime_type,
                    title=item.title,
                    uri=item.uri,
                    payload=item.payload,
                )
                for item in result.artifacts
            ],
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
            started_time=started_time,
        )

    @classmethod
    def failed(
        cls,
        task: CodeExecutionTaskMessage,
        execution_id: str,
        started_time: datetime,
    ) -> "CodeExecutionResultMessage":
        # 详细异常只写服务端日志，结果消息不携带供应商异常或密钥。
        return cls(
            run_id=task.run_id,
            execution_id=execution_id,
            status="FAILED",
            stderr="代码执行服务内部错误",
            started_time=started_time,
        )
