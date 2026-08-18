from fastapi.testclient import TestClient
from pydantic import SecretStr

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.interfaces.api.app import create_app


def test_health_endpoint() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/internal/v1/health")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "UP"


def test_demo_agent_returns_chart_artifact() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/demo-chart/invoke",
            json={"inputText": "生成学习时长图表"},
        )

    body = response.json()
    assert response.status_code == 200
    assert body["data"]["status"] == "SUCCEEDED"
    assert body["data"]["artifacts"][0]["kind"] == "CHART"
    assert body["data"]["artifacts"][0]["payload"]["mark"]["type"] == "bar"


def test_study_plan_agent_returns_table_artifact() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/study-plan/invoke",
            json={
                "inputText": "初中数学一次函数",
                "context": {
                    "grade": "八年级",
                    "durationMinutes": 60,
                    "weakPoints": ["函数图像", "斜率"],
                },
            },
        )

    body = response.json()
    data = body["data"]
    plan = data["artifacts"][0]["payload"]

    assert response.status_code == 200
    assert data["agentCode"] == "study-plan"
    assert data["status"] == "SUCCEEDED"
    assert data["artifacts"][0]["kind"] == "TABLE"
    assert sum(item["minutes"] for item in plan) == 60
    assert data["metadata"]["implementation"] == "langgraph-example"
    assert data["metadata"]["strategy"] == "targeted"
    assert data["metadata"]["weakPoints"] == ["函数图像", "斜率"]


def test_study_plan_agent_uses_general_branch_without_weak_points() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/study-plan/invoke",
            json={
                "inputText": "初中英语阅读",
                "context": {"grade": "七年级", "durationMinutes": 40},
            },
        )

    data = response.json()["data"]
    assert response.status_code == 200
    assert data["metadata"]["strategy"] == "general"
    assert sum(item["minutes"] for item in data["artifacts"][0]["payload"]) == 40


def test_unknown_agent_returns_standard_error() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/missing/invoke",
            json={"inputText": "test"},
        )

    assert response.status_code == 404
    assert response.json()["code"] == 404


def test_sandbox_is_disabled_by_default() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/sandbox/executions",
            json={"code": "print('unsafe')"},
        )

    assert response.status_code == 503
    assert response.json()["code"] == 503


def test_internal_api_key_is_enforced_when_configured() -> None:
    settings = Settings(
        _env_file=None,
        internal_api_key=SecretStr("test-internal-key"),
    )
    with TestClient(create_app(settings)) as client:
        unauthorized = client.get("/internal/v1/agents")
        authorized = client.get(
            "/internal/v1/agents",
            headers={"X-Internal-Api-Key": "test-internal-key"},
        )

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
