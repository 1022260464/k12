from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.domain.agents.ports import AgentRegistry


class AgentNotFoundError(LookupError):
    """请求的 agent_code 没有对应执行器。"""

    pass


class AgentInputError(ValueError):
    """进入具体 Agent 之前即可确定的输入错误。"""


class AgentExecutionError(RuntimeError):
    """Agent 内部执行失败；原始异常保存在 __cause__ 中供日志记录。"""


class AgentContractError(RuntimeError):
    """Agent 返回值违反平台统一契约。"""


@dataclass(frozen=True, slots=True)
class RunAgentCommand:
    agent_code: str
    input_text: str
    run_id: str | None = None
    user_id: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


class RunAgentUseCase:
    def __init__(self, registry: AgentRegistry) -> None:
        self._registry = registry

    async def execute(self, command: RunAgentCommand) -> AgentRunResult:
        agent_code = command.agent_code.strip()
        input_text = command.input_text.strip()
        if not agent_code:
            raise AgentInputError("agent_code 不能为空")
        if not input_text:
            raise AgentInputError("input_text 不能为空")

        agent = self._registry.get(agent_code)
        if agent is None:
            raise AgentNotFoundError(f"Unknown agent: {agent_code}")

        run_input = AgentRunInput(
            run_id=command.run_id or str(uuid4()),
            agent_code=agent_code,
            input_text=input_text,
            user_id=command.user_id,
            # 复制一份上下文，避免调用方在 Agent 执行期间修改同一个字典。
            context=dict(command.context),
        )
        try:
            result = await agent.invoke(run_input)
        except Exception as error:  # noqa: BLE001
            # 对外只暴露稳定错误，原始异常仍通过异常链交给 API/Worker 日志。
            raise AgentExecutionError(f"Agent execution failed: {agent_code}") from error

        self._validate_result(run_input, result)
        return result

    @staticmethod
    def _validate_result(run_input: AgentRunInput, result: AgentRunResult) -> None:
        """防止某个 Agent 的错误实现污染 Java 侧运行记录。"""
        if not isinstance(result, AgentRunResult):
            raise AgentContractError("Agent must return AgentRunResult")
        if result.run_id != run_input.run_id:
            raise AgentContractError("Agent returned a different run_id")
        if result.agent_code != run_input.agent_code:
            raise AgentContractError("Agent returned a different agent_code")
        if not isinstance(result.status, AgentRunStatus):
            raise AgentContractError("Agent returned an invalid status")
        if not isinstance(result.output_text, str):
            raise AgentContractError("Agent returned an invalid output_text")

        for artifact in result.artifacts:
            if not isinstance(artifact, AgentArtifact):
                raise AgentContractError("Agent returned an invalid artifact")
            if not isinstance(artifact.kind, AgentArtifactKind):
                raise AgentContractError("Agent returned an invalid artifact kind")
            if not isinstance(artifact.artifact_id, str) or not artifact.artifact_id.strip():
                raise AgentContractError("Agent returned an empty artifact_id")
            if not isinstance(artifact.mime_type, str) or not artifact.mime_type.strip():
                raise AgentContractError("Agent returned an empty artifact mime_type")

        artifact_ids = [artifact.artifact_id for artifact in result.artifacts]
        if len(artifact_ids) != len(set(artifact_ids)):
            raise AgentContractError("Agent returned duplicate artifact_id values")
