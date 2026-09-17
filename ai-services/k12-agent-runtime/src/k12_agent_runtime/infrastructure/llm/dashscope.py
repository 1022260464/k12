from typing import Any

import httpx

from k12_agent_runtime.domain.llm.models import ChatRequest, ChatResponse


class ChatModelError(RuntimeError):
    """可安全记录的模型调用异常，不携带 API Key 或完整响应正文。"""

    def __init__(self, code: str, status_code: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code


class DashScopeChatModel:
    """通过 OpenAI 兼容协议调用阿里云百炼千问模型。"""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not base_url.strip() or not api_key.strip() or not model.strip():
            raise ValueError("千问模型的 base_url、api_key 和 model 均不能为空")
        self._endpoint = f"{base_url.rstrip('/')}/chat/completions"
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def complete(self, request: ChatRequest) -> ChatResponse:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": message.role, "content": message.content}
                for message in request.messages
            ],
            "temperature": request.temperature,
            "max_tokens": request.max_output_tokens,
        }
        if request.json_response:
            payload["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    self._endpoint,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise ChatModelError("timeout") from exc
        except httpx.HTTPStatusError as exc:
            raise ChatModelError("provider_http_error", exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise ChatModelError("network_error") from exc

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            response_model = body.get("model", self._model)
            usage = body.get("usage", {})
            if not isinstance(content, str) or not content.strip():
                raise ValueError("empty content")
            if not isinstance(response_model, str):
                response_model = self._model
            if not isinstance(usage, dict):
                usage = {}
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ChatModelError("invalid_response") from exc

        return ChatResponse(content=content.strip(), model=response_model, usage=usage)
