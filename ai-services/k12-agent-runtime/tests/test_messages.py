from k12_agent_runtime.infrastructure.messaging.messages import AgentRunTaskMessage


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
