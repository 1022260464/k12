import asyncio

import httpx

from k12_agent_runtime.domain.llm import ChatMessage, ChatRequest
from k12_agent_runtime.infrastructure.llm import ChatModelError, DashScopeChatModel


def test_complete_uses_openai_compatible_protocol() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://example.test/compatible-mode/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer test-api-key"
        body = __import__("json").loads(request.content)
        assert body["model"] == "qwen-test"
        assert body["response_format"] == {"type": "json_object"}
        assert body["messages"][0]["role"] == "user"
        return httpx.Response(
            200,
            json={
                "model": "qwen-test",
                "choices": [{"message": {"content": '{"answer":"ok"}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4, "total_tokens": 14},
            },
        )

    model = DashScopeChatModel(
        base_url="https://example.test/compatible-mode/v1/",
        api_key="test-api-key",
        model="qwen-test",
        transport=httpx.MockTransport(handler),
    )
    response = asyncio.run(
        model.complete(
            ChatRequest(
                messages=(ChatMessage(role="user", content="只返回JSON"),),
                json_response=True,
            )
        )
    )

    assert response.content == '{"answer":"ok"}'
    assert response.usage["total_tokens"] == 14


def test_http_error_is_converted_to_safe_domain_error() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "sensitive provider response"})

    model = DashScopeChatModel(
        base_url="https://example.test/v1",
        api_key="test-api-key",
        model="qwen-test",
        transport=httpx.MockTransport(handler),
    )

    try:
        asyncio.run(
            model.complete(
                ChatRequest(messages=(ChatMessage(role="user", content="test"),))
            )
        )
    except ChatModelError as exc:
        assert exc.code == "provider_http_error"
        assert exc.status_code == 401
        assert "sensitive" not in str(exc)
    else:
        raise AssertionError("应将HTTP错误转换为ChatModelError")
