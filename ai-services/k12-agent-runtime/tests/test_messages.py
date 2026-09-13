import json
from datetime import UTC, datetime

from k12_agent_runtime.infrastructure.messaging.messages import (
    AgentRunResultMessage,
    AgentRunTaskMessage,
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
