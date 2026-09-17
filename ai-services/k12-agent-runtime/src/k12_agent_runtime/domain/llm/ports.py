from typing import Protocol

from k12_agent_runtime.domain.llm.models import ChatRequest, ChatResponse


class ChatModel(Protocol):
    """应用依赖的模型端口，具体厂商适配器在 infrastructure 中实现。"""

    async def complete(self, request: ChatRequest) -> ChatResponse: ...
