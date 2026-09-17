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


def test_teaching_assistant_is_registered_and_adapts_to_stage() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        agents = client.get("/internal/v1/agents")
        response = client.post(
            "/internal/v1/agents/teaching-assistant/invoke",
            json={
                "inputText": "为什么冒泡排序要比较旁边的数字？",
                "context": {
                    "stage": "小学高年级",
                    "grade": "六年级",
                    "topic": "冒泡排序",
                },
            },
        )

    agent_codes = {item["code"] for item in agents.json()["data"]}
    data = response.json()["data"]
    assert "teaching-assistant" in agent_codes
    assert response.status_code == 200
    assert data["metadata"]["stage"] == "小学高年级"
    assert data["artifacts"][0]["kind"] == "ANIMATION"
    assert data["artifacts"][0]["payload"]["schemaVersion"] == "1.0"


def test_unknown_agent_returns_standard_error() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/missing/invoke",
            json={"inputText": "test"},
        )

    assert response.status_code == 404
    assert response.json()["code"] == 404


def test_blank_agent_input_returns_standard_validation_error() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/agents/study-plan/invoke",
            json={"inputText": "   "},
        )

    assert response.status_code == 422
    assert response.json()["code"] == 422
    assert response.json()["data"] is None


def test_sandbox_is_disabled_by_default() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/sandbox/executions",
            json={"code": "print('unsafe')"},
        )

    assert response.status_code == 503
    assert response.json()["code"] == 503


def test_sandbox_rejects_runtime_package_installation_before_execution() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post(
            "/internal/v1/sandbox/executions",
            json={"code": "print('safe')", "packages": ["requests"]},
        )

    assert response.status_code == 422
    assert "不能临时安装依赖" in response.json()["message"]


def test_local_piston_capabilities_reflect_provider_limit() -> None:
    settings = Settings(
        _env_file=None,
        sandbox_enabled=True,
        sandbox_provider="local_piston",
        sandbox_timeout_seconds=30,
        piston_run_timeout_ms=3000,
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/internal/v1/sandbox/capabilities")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["enabled"] is True
    assert data["executionMode"] == "local_piston"
    assert data["limits"]["timeoutSeconds"] == 3


def test_sandbox_capabilities_expose_configured_failover_chain() -> None:
    settings = Settings(
        _env_file=None,
        sandbox_enabled=True,
        sandbox_provider="local_piston",
        sandbox_fallback_provider="tencent_agsx",
        e2b_domain="ap-guangzhou.tencentags.com",
        e2b_api_key=SecretStr("e2b_0000000000000000000000000000000000000000"),
    )
    with TestClient(create_app(settings)) as client:
        response = client.get("/internal/v1/sandbox/capabilities")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["executionMode"] == "local_piston->tencent_agsx"
    assert data["limits"]["timeoutSeconds"] == 3


def test_rag_capabilities_and_inference_are_disabled_by_default() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        capabilities = client.get("/internal/v1/rag/capabilities")
        embedding = client.post(
            "/internal/v1/rag/embeddings",
            json={"texts": ["什么是人工智能"]},
        )

    assert capabilities.status_code == 200
    assert capabilities.json()["data"]["enabled"] is False
    assert capabilities.json()["data"]["storageEnabled"] is False
    assert capabilities.json()["data"]["embeddingModel"] == "BAAI/bge-m3"
    assert embedding.status_code == 503
    assert embedding.json()["code"] == 503


def test_rag_storage_endpoints_are_disabled_without_configuration() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        index_response = client.post(
            "/internal/v1/rag/documents/index",
            json={
                "title": "人工智能入门",
                "content": "机器可以从数据中学习规律。",
                "sourceType": "manual",
            },
        )
        search_response = client.post(
            "/internal/v1/rag/search",
            json={"query": "什么是机器学习？"},
        )

    assert index_response.status_code == 503
    assert search_response.status_code == 503


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


def test_storage_is_disabled_by_default() -> None:
    with TestClient(create_app(Settings(_env_file=None))) as client:
        capabilities = client.get("/internal/v1/storage/capabilities")
        upload = client.post(
            "/internal/v1/storage/objects",
            files={"file": ("demo.txt", b"demo", "text/plain")},
        )

    assert capabilities.status_code == 200
    assert capabilities.json()["data"]["enabled"] is False
    assert upload.status_code == 503
