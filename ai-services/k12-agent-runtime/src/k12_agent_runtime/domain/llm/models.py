from dataclasses import dataclass, field
from typing import Any, Literal

ChatRole = Literal["system", "user", "assistant"]


@dataclass(frozen=True, slots=True)
class ChatMessage:
    """一条与厂商无关的对话消息。"""

    role: ChatRole
    content: str


@dataclass(frozen=True, slots=True)
class ChatRequest:
    """应用层提交给大模型的统一请求。"""

    messages: tuple[ChatMessage, ...]
    json_response: bool = False
    temperature: float = 0.2
    max_output_tokens: int = 1200


@dataclass(frozen=True, slots=True)
class ChatResponse:
    """模型返回的文本和不包含敏感信息的用量元数据。"""

    content: str
    model: str
    usage: dict[str, Any] = field(default_factory=dict)
