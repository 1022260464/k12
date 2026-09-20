"""Python 编程实验专用教练：只做代码审查与写码指导，不走知识图谱/课程推荐。"""

from __future__ import annotations

from typing import Any

from k12_agent_runtime.domain.agents.models import (
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.domain.llm.models import ChatMessage, ChatRequest
from k12_agent_runtime.infrastructure.llm.dashscope import ChatModelError

_SYSTEM_PROMPT = """你是 K12 编程实验里的 Python 代码教练。

职责（只做这些）：
1. 审查学生当前代码：指出语法错误、逻辑问题、可读性与常见坑。
2. 引导学生自己改：先讲思路与关键改法，不要一上来整段代写；学生明确要求完整代码时再给出。
3. 结合运行输出/报错解释原因，并给出可执行的下一步修改建议。
4. 用适合初中/高中的中文，简短分点，可用小段代码示例。

明确不要做：
- 不要推荐知识图谱节点、课程章节或“教学闭环”话术。
- 不要出课堂小测、动画步骤或固定模板讲解。
- 不要声称已在本地执行代码；只能根据学生提供的代码与运行结果分析。
"""

_MAX_CODE = 4000
_MAX_IO = 1500
_MAX_HISTORY_TURNS = 6


def _clip(value: object, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit]}\n…（已截断）"


def _history_messages(context: dict[str, Any]) -> list[ChatMessage]:
    raw = context.get("conversationHistory")
    if not isinstance(raw, list):
        return []
    messages: list[ChatMessage] = []
    for turn in raw[-_MAX_HISTORY_TURNS:]:
        if not isinstance(turn, dict):
            continue
        user = _clip(turn.get("user"), 1200)
        assistant = _clip(turn.get("assistant"), 1800)
        if user:
            messages.append(ChatMessage(role="user", content=user))
        if assistant:
            messages.append(ChatMessage(role="assistant", content=assistant))
    return messages


def _build_user_payload(run_input: AgentRunInput) -> str:
    context = run_input.context if isinstance(run_input.context, dict) else {}
    code = _clip(context.get("code") or "", _MAX_CODE)
    stdout = _clip(context.get("stdout") or "", _MAX_IO)
    stderr = _clip(context.get("stderr") or "", _MAX_IO)
    status = _clip(context.get("runStatus") or "", 64)
    example = _clip(context.get("exampleLabel") or "", 80)
    intent = _clip(context.get("intent") or "guide", 32)
    question = _clip(run_input.input_text, 2000)

    parts = [
        f"学生意图：{intent}",
        f"学生问题：{question or '（请直接审查当前代码）'}",
    ]
    if example:
        parts.append(f"示例主题：{example}")
    parts.append("当前代码：\n```python\n" + (code or "# （编辑器为空）") + "\n```")
    if status or stdout or stderr:
        parts.append(f"最近运行状态：{status or '未知'}")
        if stdout:
            parts.append(f"标准输出：\n{stdout}")
        if stderr:
            parts.append(f"错误输出：\n{stderr}")
    else:
        parts.append("（尚未提供运行结果）")
    return "\n\n".join(parts)


class PythonCodeCoachAgent:
    """轻量代码教练：单轮 LLM 对话，不挂 RAG / 图谱 / 模板课。"""

    def __init__(self, chat_model: ChatModel | None) -> None:
        self._chat_model = chat_model

    @property
    def code(self) -> str:
        return "python-code-coach"

    @property
    def description(self) -> str:
        return "编程实验专用：审查 Python 代码并指导修改，不走知识图谱与课程推荐。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        if self._chat_model is None:
            return AgentRunResult(
                run_id=run_input.run_id,
                agent_code=self.code,
                status=AgentRunStatus.SUCCEEDED,
                output_text="代码教练暂不可用：未配置对话模型。请联系管理员检查 Agent Runtime 的模型密钥。",
                artifacts=(),
                metadata={"reason": "chat_model_disabled"},
            )

        context = run_input.context if isinstance(run_input.context, dict) else {}
        messages = [
            ChatMessage(role="system", content=_SYSTEM_PROMPT),
            *_history_messages(context),
            ChatMessage(role="user", content=_build_user_payload(run_input)),
        ]
        try:
            response = await self._chat_model.complete(
                ChatRequest(messages=tuple(messages), temperature=0.3, max_output_tokens=1600)
            )
            text = (response.content or "").strip() or "我暂时没有生成有效建议，请换个问法再试一次。"
            return AgentRunResult(
                run_id=run_input.run_id,
                agent_code=self.code,
                status=AgentRunStatus.SUCCEEDED,
                output_text=text,
                artifacts=(),
                metadata={
                    "coach": "python-code-coach",
                    "model": response.model,
                    "usage": response.usage,
                },
            )
        except ChatModelError as error:
            return AgentRunResult(
                run_id=run_input.run_id,
                agent_code=self.code,
                status=AgentRunStatus.SUCCEEDED,
                output_text="代码教练调用模型失败，请稍后重试。",
                artifacts=(),
                metadata={"reason": str(error.code), "statusCode": error.status_code},
            )
