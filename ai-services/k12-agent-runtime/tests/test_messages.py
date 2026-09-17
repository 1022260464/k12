import json
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from k12_agent_runtime.domain.sandbox import CodeExecutionResult, CodeExecutionStatus
from k12_agent_runtime.infrastructure.messaging.messages import (
    AgentRunResultMessage,
    AgentRunTaskMessage,
    CodeExecutionResultMessage,
    CodeExecutionTaskMessage,
)


def test_rabbitmq_task_message_uses_java_friendly_camel_case() -> None:
    task = AgentRunTaskMessage(
        run_id="run-1",
        agent_code="demo-chart",
        input_text="test",
    )

    payload = task.model_dump(by_alias=True)

    assert payload["runId"] == "run-1"
    assert payload["agentCode"] == "demo-chart"
    assert payload["inputText"] == "test"


def test_started_message_contains_camel_case_utc_timestamp() -> None:
    task = AgentRunTaskMessage(
        run_id="run-1",
        agent_code="demo-chart",
        input_text="test",
    )
    started_time = datetime(2026, 9, 13, 8, 41, 18, tzinfo=UTC)

    message = AgentRunResultMessage.started(task, started_time)
    payload = json.loads(message.model_dump_json(by_alias=True))

    assert payload["status"] == "RUNNING"
    assert payload["startedTime"] == "2026-09-13T08:41:18Z"


def test_rabbitmq_task_rejects_blank_required_text() -> None:
    with pytest.raises(ValidationError):
        AgentRunTaskMessage(
            run_id="run-1",
            agent_code="study-plan",
            input_text="   ",
        )


def test_code_execution_messages_match_java_camel_case_contract() -> None:
    task = CodeExecutionTaskMessage(
        run_id="run-code-1",
        code="print('hello')",
        timeout_seconds=12,
    )
    started_time = datetime(2026, 9, 16, 0, 10, tzinfo=UTC)
    started = json.loads(
        CodeExecutionResultMessage.started(task, started_time).model_dump_json(
            by_alias=True
        )
    )
    result = CodeExecutionResultMessage.from_domain(
        task,
        CodeExecutionResult(
            execution_id="exec-1",
            status=CodeExecutionStatus.SUCCEEDED,
            stdout="hello\n",
            exit_code=0,
            duration_ms=25,
        ),
        started_time,
    ).model_dump(by_alias=True)

    assert task.model_dump(by_alias=True)["timeoutSeconds"] == 12
    assert started["runId"] == "run-code-1"
    assert started["startedTime"] == "2026-09-16T00:10:00Z"
    assert result["executionId"] == "exec-1"
    assert result["durationMs"] == 25


def test_code_execution_task_rejects_runtime_packages() -> None:
    with pytest.raises(ValidationError):
        CodeExecutionTaskMessage(
            run_id="run-code-1",
            code="print(1)",
            packages=["requests"],
        )
