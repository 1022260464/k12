"""大模型厂商适配器。"""

from k12_agent_runtime.infrastructure.llm.dashscope import (
    ChatModelError,
    DashScopeChatModel,
)

__all__ = ["ChatModelError", "DashScopeChatModel"]
