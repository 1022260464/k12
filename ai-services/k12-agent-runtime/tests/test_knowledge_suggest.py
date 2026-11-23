from fastapi.testclient import TestClient

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.llm import ChatResponse
from k12_agent_runtime.interfaces.api.app import create_app
from k12_agent_runtime.interfaces.api.routes.knowledge import (
    _parse_suggest_json,
    _parse_summary_json,
)


def test_parse_suggest_json_from_plain_object():
    data = _parse_suggest_json('{"codes":["a.b"],"reasons":{"a.b":"相关"}}')
    assert data["codes"] == ["a.b"]
    assert data["reasons"]["a.b"] == "相关"


def test_parse_suggest_json_from_markdown_fence():
    raw = """```json
{"codes":["x.y"],"reasons":{}}
```"""
    data = _parse_suggest_json(raw)
    assert data["codes"] == ["x.y"]


def test_parse_summary_json_rejects_non_string_summary():
    assert _parse_summary_json('{"summary":{"text":"bad"}}') == ""
    assert _parse_summary_json("not-json") == ""


def test_summarize_conversation_uses_controlled_rolling_prompt() -> None:
    class SummaryChatModel:
        def __init__(self) -> None:
            self.request = None

        async def complete(self, request):
            self.request = request
            return ChatResponse(
                content='{"summary":"学习目标：图像分类；误解：把测试集当训练集。"}',
                model="qwen-test",
                usage={},
            )

    model = SummaryChatModel()
    with TestClient(create_app(Settings(_env_file=None))) as client:
        object.__setattr__(client.app.state.container, "chat_model", model)
        response = client.post(
            "/internal/v1/knowledge/summarize-conversation",
            json={
                "previousSummary": "学习目标：认识图像分类。",
                "summarizedTurnCount": 5,
                "turns": [
                    {
                        "user": "训练集和测试集有什么区别？",
                        "assistant": "训练集用来学习，测试集用来检查新图片。",
                    }
                ],
            },
        )

    body = response.json()
    assert body["code"] == 200
    assert "测试集" in body["data"]["summary"]
    prompt = model.request.messages[1].content
    assert "已有摘要" in prompt
    assert "不可信数据" in prompt
    assert "训练集和测试集有什么区别" in prompt
