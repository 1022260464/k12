from typing import Any

from pydantic import Field

from k12_agent_runtime.domain.agents.models import AgentArtifact, AgentRunResult
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel


class AgentInfoResponse(ApiModel):
    code: str
    description: str


class AgentInvokeRequest(ApiModel):
    input_text: str = Field(min_length=1, max_length=20_000)
    user_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class ArtifactResponse(ApiModel):
    artifact_id: str
    kind: str
    mime_type: str
    title: str | None = None
    uri: str | None = None
    payload: dict[str, Any] | list[Any] | str | None = None

    @classmethod
    def from_domain(cls, artifact: AgentArtifact) -> "ArtifactResponse":
        return cls(
            artifact_id=artifact.artifact_id,
            kind=artifact.kind.value,
            mime_type=artifact.mime_type,
            title=artifact.title,
            uri=artifact.uri,
            payload=artifact.payload,
        )


class AgentRunResponse(ApiModel):
    run_id: str
    agent_code: str
    status: str
    output_text: str
    artifacts: list[ArtifactResponse]
    metadata: dict[str, Any]

    @classmethod
    def from_domain(cls, result: AgentRunResult) -> "AgentRunResponse":
        return cls(
            run_id=result.run_id,
            agent_code=result.agent_code,
            status=result.status.value,
            output_text=result.output_text,
            artifacts=[ArtifactResponse.from_domain(item) for item in result.artifacts],
            metadata=result.metadata,
        )
