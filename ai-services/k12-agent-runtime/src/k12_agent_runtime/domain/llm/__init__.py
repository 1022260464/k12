"""大模型领域协议，不依赖任何云厂商 SDK。"""

from k12_agent_runtime.domain.llm.models import ChatMessage, ChatRequest, ChatResponse
from k12_agent_runtime.domain.llm.ports import ChatModel

__all__ = ["ChatMessage", "ChatModel", "ChatRequest", "ChatResponse"]
