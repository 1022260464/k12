from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from k12_agent_runtime.domain.agents.models import AgentRunResult


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
