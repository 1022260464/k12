import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.infrastructure.observability.jsonl_trace_repository import (
    JsonlAgentTraceRepository,
)

_TRACE_PREFIX = "agent-trace-test-"


@pytest.fixture
def trace_dir():
    directory = Path(__file__).resolve().parent / ".trace-output"
    _remove_test_files(directory)
    try:
        yield directory
    finally:
        _remove_test_files(directory)


def test_jsonl_trace_records_started_and_succeeded_with_redaction(trace_dir) -> None:
    repository = JsonlAgentTraceRepository(
        log_dir=trace_dir,
        retention_days=30,
        file_prefix=_TRACE_PREFIX,
    )
    run_input = AgentRunInput(
        run_id="run-success",
        agent_code="teaching-assistant",
        input_text="解释人工智能",
        user_id="student-1",
        context={
            "stage": "小学低年级",
            "api_key": "must-not-be-written",
            "nested": {"authorization": "Bearer secret", "topic": "图像分类"},
        },
    )
    result = AgentRunResult(
        run_id=run_input.run_id,
        agent_code=run_input.agent_code,
        status=AgentRunStatus.SUCCEEDED,
        output_text="机器会从图片中学习特征。",
        artifacts=(
            AgentArtifact(
                artifact_id="artifact-1",
                kind=AgentArtifactKind.IMAGE,
                mime_type="image/png",
            ),
        ),
        metadata={"apiToken": "must-not-be-written", "topicCode": "vision.classification"},
    )

    asyncio.run(repository.record_started(run_input))
    asyncio.run(repository.record_succeeded(run_input, result))

    events = _read_events(trace_dir)
    assert [event["event"] for event in events] == ["STARTED", "SUCCEEDED"]
    assert all(event["schema_version"] == 1 for event in events)
    assert events[0]["input_text"] == "解释人工智能"
    assert events[0]["context"]["api_key"] == "[REDACTED]"
    assert events[0]["context"]["nested"]["authorization"] == "[REDACTED]"
    assert events[1]["artifact_ids"] == ["artifact-1"]
    assert events[1]["output_metadata"]["apiToken"] == "[REDACTED]"
    assert "must-not-be-written" not in (
        trace_dir / _trace_filename(_TRACE_PREFIX)
    ).read_text(encoding="utf-8")


def test_jsonl_trace_records_failed_event(trace_dir) -> None:
    repository = JsonlAgentTraceRepository(
        log_dir=trace_dir,
        retention_days=30,
        file_prefix=_TRACE_PREFIX,
    )
    run_input = AgentRunInput(
        run_id="run-failed",
        agent_code="teaching-assistant",
        input_text="test",
    )

    asyncio.run(repository.record_failed(run_input, "ProviderTimeout"))

    [event] = _read_events(trace_dir)
    assert event["event"] == "FAILED"
    assert event["status"] == "FAILED"
    assert event["error_type"] == "ProviderTimeout"


def test_jsonl_trace_prunes_files_older_than_retention(trace_dir) -> None:
    today = datetime.now(UTC).date()
    expired = trace_dir / f"{_TRACE_PREFIX}{(today - timedelta(days=31)).isoformat()}.jsonl"
    retained = trace_dir / f"{_TRACE_PREFIX}{(today - timedelta(days=29)).isoformat()}.jsonl"
    expired.write_text("{}\n", encoding="utf-8")
    retained.write_text("{}\n", encoding="utf-8")
    repository = JsonlAgentTraceRepository(
        log_dir=trace_dir,
        retention_days=30,
        file_prefix=_TRACE_PREFIX,
    )

    asyncio.run(
        repository.record_failed(
            AgentRunInput(
                run_id="run-prune",
                agent_code="teaching-assistant",
                input_text="test",
            ),
            "TestError",
        )
    )

    assert not expired.exists()
    assert retained.exists()


def _read_events(directory: Path) -> list[dict]:
    target = directory / _trace_filename(_TRACE_PREFIX)
    return [
        json.loads(line)
        for line in target.read_text(encoding="utf-8").splitlines()
        if line
    ]


def _trace_filename(prefix: str) -> str:
    return f"{prefix}{datetime.now(UTC).date().isoformat()}.jsonl"


def _remove_test_files(directory: Path) -> None:
    for path in directory.glob(f"{_TRACE_PREFIX}*.jsonl"):
        path.unlink()
