import json
import logging
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from k12_agent_runtime.domain.llm import ChatMessage, ChatModel, ChatRequest
from k12_agent_runtime.infrastructure.agents.teaching_assistant.state import (
    TeachingAssistantState,
)
from k12_agent_runtime.infrastructure.llm import ChatModelError

StageRoute = Literal["lower_primary", "upper_primary", "middle_school", "high_school"]

logger = logging.getLogger(__name__)


class TeachingGuidance(BaseModel):
    """约束模型只能返回四段教学文本，防止不稳定字段污染工作流状态。"""

    explanation: str = Field(min_length=1, max_length=1200)
    example: str = Field(min_length=1, max_length=800)
    understanding_check: str = Field(min_length=1, max_length=400)
    next_step: str = Field(min_length=1, max_length=400)

_SUPPORTED_STAGES: tuple[StageRoute, ...] = (
    "lower_primary",
    "upper_primary",
    "middle_school",
    "high_school",
)

_STAGE_ALIASES: dict[str, StageRoute] = {
    "小学低年级": "lower_primary",
    "小学高年级": "upper_primary",
    "初中": "middle_school",
    "高中": "high_school",
    "lower_primary": "lower_primary",
    "upper_primary": "upper_primary",
    "middle_school": "middle_school",
    "high_school": "high_school",
}

_STAGE_LABELS: dict[StageRoute, str] = {
    "lower_primary": "小学低年级",
    "upper_primary": "小学高年级",
    "middle_school": "初中",
    "high_school": "高中",
}


def normalize_learning_context(state: TeachingAssistantState) -> dict[str, Any]:
    """节点一：把前端或 Java 传入的松散 context 转成稳定的教学上下文。"""
    run_input = state["run_input"]
    context = run_input.context
    stage = _read_stage(context)
    return {
        "stage": stage,
        "grade": _read_text(context, "grade", _default_grade(stage)),
        "textbook": _read_text(context, "textbook", "AI 通识课程"),
        "chapter": _read_text(context, "chapter", "算法如何整理信息"),
        "topic": _read_topic(context, run_input.input_text),
        "weak_points": _read_text_list(context, "knownWeakPoints"),
        "preferred_interactions": _read_text_list(context, "preferredInteraction"),
    }


def route_stage(state: TeachingAssistantState) -> StageRoute:
    """条件路由：学段决定语言、概念深度、例子和练习方式。"""
    stage = state["stage"]
    if stage not in _SUPPORTED_STAGES:
        return "middle_school"
    return stage  # type: ignore[return-value]


def build_lower_primary_explanation(state: TeachingAssistantState) -> dict[str, Any]:
    """低年级避免代码和复杂术语，以故事化观察和口头互动为主。"""
    return {
        "strategy": "story-and-observation",
        "learning_goal": "能看懂两个相邻数字的大小，并知道较大的数字会逐步移动。",
        "explanation": (
            "把数字想成排队的小卡片。每次只让旁边的两张卡片比一比，"
            "如果前面的数字更大，就让它们交换位置。重复几轮后，最大的数字会慢慢走到最后。"
        ),
        "example": "先观察 5 和 2：因为 5 比 2 大，所以它们交换，队伍变成 2、5、4、1。",
    }


def build_upper_primary_explanation(state: TeachingAssistantState) -> dict[str, Any]:
    """高年级保留生活化比喻，同时引入“相邻比较”和“轮次”概念。"""
    return {
        "strategy": "analogy-and-steps",
        "learning_goal": "理解相邻比较、交换和一轮排序之间的关系。",
        "explanation": (
            "冒泡排序会从左到右比较相邻的两个数字。当前面的数字更大时就交换它们。"
            "完成一轮比较后，这一轮中最大的数字会到达右侧，像气泡浮到水面一样。"
        ),
        "example": "对 5、2、4、1 做第一轮比较，5 会依次和右边数字交换，最后移动到队尾。",
    }


def build_middle_school_explanation(state: TeachingAssistantState) -> dict[str, Any]:
    """初中阶段强调算法步骤、循环和已排序区间。"""
    return {
        "strategy": "concept-and-pseudocode",
        "learning_goal": "能根据比较和交换步骤手动完成一轮冒泡排序。",
        "explanation": (
            "冒泡排序通过多轮遍历完成排序。每轮从左到右比较相邻元素，顺序错误时交换；"
            "一轮结束后，当前未排序区间的最大元素会被放到末尾，因此下一轮可以少比较一次。"
        ),
        "example": "数组 5、2、4、1 完成第一轮后会变成 2、4、1、5，最后的 5 已经有序。",
    }


def build_high_school_explanation(state: TeachingAssistantState) -> dict[str, Any]:
    """高中阶段补充复杂度、稳定性和工程上的适用范围。"""
    return {
        "strategy": "formal-and-code-ready",
        "learning_goal": "能解释冒泡排序的不变式、复杂度，并实现带提前结束优化的代码。",
        "explanation": (
            "冒泡排序在第 i 轮结束后，会把未排序区间中的最大元素放到该区间末尾。"
            "普通实现的平均和最坏时间复杂度为 O(n²)，额外空间复杂度为 O(1)，并且是稳定排序。"
            "如果某一轮没有发生交换，可以提前结束，使已有序输入接近 O(n)。"
        ),
        "example": (
            "实现时使用外层循环控制轮次，内层循环比较 a[j] 与 a[j + 1]，"
            "并用 swapped 标记记录本轮是否发生交换。"
        ),
    }


def build_interaction(state: TeachingAssistantState) -> dict[str, Any]:
    """节点三：生成不含可执行代码的动画协议和理解检查。"""
    values = _values_for_stage(state["stage"])
    animation = {
        "schemaVersion": "1.0",
        "animationType": "bubble-sort",
        "title": f"{state['topic']}逐步演示",
        "controls": ["play", "pause", "step", "restart"],
        "initialValues": values,
        "steps": _build_bubble_sort_steps(values, state["stage"]),
        "learningGoal": state["learning_goal"],
    }
    return {
        "animation_payload": animation,
        "understanding_check": _understanding_check_for_stage(state["stage"]),
    }


async def enhance_with_chat_model(
    state: TeachingAssistantState,
    chat_model: ChatModel | None,
) -> dict[str, Any]:
    """节点四：让模型润色教学文本；调用失败时保留前面节点的确定性结果。"""
    if chat_model is None:
        return {"model_used": False, "model_fallback_reason": "not_configured"}

    context = {
        "stage": _STAGE_LABELS[state["stage"]],
        "grade": state["grade"],
        "textbook": state["textbook"],
        "chapter": state["chapter"],
        "topic": state["topic"],
        "question": state["run_input"].input_text,
        "weakPoints": state["weak_points"],
        "preferredInteractions": state["preferred_interactions"],
        "deterministicExplanation": state["explanation"],
        "deterministicExample": state["example"],
    }
    request = ChatRequest(
        messages=(
            ChatMessage(
                role="system",
                content=(
                    "你是面向K12学生的人工智能通识课教师。回答必须适龄、准确、简洁，"
                    "不得要求学生执行危险操作，不得输出HTML、JavaScript或可执行代码。"
                    "只返回JSON对象，且必须包含explanation、example、"
                    "understanding_check、next_step四个字符串字段。"
                ),
            ),
            ChatMessage(
                role="user",
                content=(
                    "请依据以下教学上下文生成讲解。不要改变主题，不要声称已经读取不存在的"
                    f"教材内容。上下文：{json.dumps(context, ensure_ascii=False)}"
                ),
            ),
        ),
        json_response=True,
    )

    try:
        response = await chat_model.complete(request)
        guidance = TeachingGuidance.model_validate_json(response.content)
    except ChatModelError as exc:
        logger.warning(
            "教学模型调用失败，已使用确定性降级：code=%s status=%s",
            exc.code,
            exc.status_code,
        )
        return {"model_used": False, "model_fallback_reason": exc.code}
    except ValidationError:
        logger.warning("教学模型返回格式不符合约束，已使用确定性降级")
        return {"model_used": False, "model_fallback_reason": "invalid_content"}

    return {
        "explanation": guidance.explanation,
        "example": guidance.example,
        "understanding_check": guidance.understanding_check,
        "next_step": guidance.next_step,
        "model_used": True,
        "model_name": response.model,
        "model_usage": _safe_usage(response.usage),
    }


def compose_response(state: TeachingAssistantState) -> dict[str, Any]:
    """节点五：组装稳定的教学回答和可观测元数据。"""
    weak_points = state["weak_points"]
    weak_point_note = f"本轮重点关注：{'、'.join(weak_points)}。\n\n" if weak_points else ""
    default_next_step = (
        "先说出你的判断和理由，再继续下一轮动画；系统不会直接替你完成任务。"
    )
    output_text = (
        f"【概念解释】\n{state['explanation']}\n\n"
        f"【互动示例】\n{state['example']}你可以使用下方动画逐步观察每次比较。\n\n"
        f"{weak_point_note}"
        f"【理解检查】\n{state['understanding_check']}\n\n"
        "【下一步建议】\n"
        f"{state.get('next_step', default_next_step)}"
    )
    model_used = state.get("model_used", False)
    metadata: dict[str, Any] = {
        "implementation": (
            "llm-assisted-langgraph" if model_used else "deterministic-langgraph"
        ),
        "workflow": "teaching-assistant-v1",
        "domain": "ai-literacy",
        "stage": _STAGE_LABELS[state["stage"]],
        "stageCode": state["stage"],
        "grade": state["grade"],
        "textbook": state["textbook"],
        "chapter": state["chapter"],
        "topic": state["topic"],
        "strategy": state["strategy"],
        "weakPoints": weak_points,
        "preferredInteractions": state["preferred_interactions"],
        "generatedInteractions": ["ANIMATION", "UNDERSTANDING_CHECK"],
        "modelUsed": model_used,
    }
    if model_used:
        metadata["model"] = state.get("model_name")
        metadata["modelUsage"] = state.get("model_usage", {})
    else:
        metadata["modelFallbackReason"] = state.get(
            "model_fallback_reason", "not_configured"
        )
    return {
        "output_text": output_text,
        "metadata": metadata,
    }


def _safe_usage(usage: dict[str, Any]) -> dict[str, int]:
    """只保留常见的整数Token计数，不透传厂商返回的其他字段。"""
    allowed_keys = (
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "input_tokens",
        "output_tokens",
    )
    return {
        key: value
        for key in allowed_keys
        if isinstance((value := usage.get(key)), int) and value >= 0
    }


def _build_bubble_sort_steps(values: list[int], stage: str) -> list[dict[str, Any]]:
    """生成确定性的冒泡排序动画帧，前端只解释数据，不执行模型脚本。"""
    current = values.copy()
    steps: list[dict[str, Any]] = []
    step_number = 1
    for pass_index in range(len(current) - 1):
        swapped = False
        for index in range(len(current) - 1 - pass_index):
            steps.append(
                {
                    "step": step_number,
                    "pass": pass_index + 1,
                    "action": "compare",
                    "indices": [index, index + 1],
                    "values": current.copy(),
                    "narration": _compare_narration(current, index, stage),
                }
            )
            step_number += 1
            if current[index] > current[index + 1]:
                current[index], current[index + 1] = current[index + 1], current[index]
                swapped = True
                steps.append(
                    {
                        "step": step_number,
                        "pass": pass_index + 1,
                        "action": "swap",
                        "indices": [index, index + 1],
                        "values": current.copy(),
                        "narration": "顺序不正确，交换这两个相邻数字。",
                    }
                )
                step_number += 1
        steps.append(
            {
                "step": step_number,
                "pass": pass_index + 1,
                "action": "pass_complete",
                "indices": [],
                "values": current.copy(),
                "narration": f"第 {pass_index + 1} 轮结束，右侧有序区间扩大。",
            }
        )
        step_number += 1
        if not swapped:
            break
    steps.append(
        {
            "step": step_number,
            "pass": None,
            "action": "complete",
            "indices": [],
            "values": current.copy(),
            "narration": "排序完成。",
        }
    )
    return steps


def _compare_narration(values: list[int], index: int, stage: str) -> str:
    left = values[index]
    right = values[index + 1]
    if stage in {"lower_primary", "upper_primary"}:
        return f"比较旁边的 {left} 和 {right}，看看谁应该站在右边。"
    return f"比较索引 {index} 和 {index + 1} 的元素：{left} 与 {right}。"


def _understanding_check_for_stage(stage: str) -> str:
    if stage == "lower_primary":
        return "看到相邻的 5 和 2 时，需要交换吗？请说说为什么。"
    if stage == "upper_primary":
        return "数组 5、2、4、1 完成第一轮后，哪个数字一定会在最后？"
    if stage == "middle_school":
        return "为什么完成一轮后，下一轮可以少比较最后一个位置？"
    return "加入 swapped 标记后，为什么最好情况下的时间复杂度可以达到 O(n)？"


def _values_for_stage(stage: str) -> list[int]:
    if stage == "lower_primary":
        return [4, 2, 3]
    if stage == "upper_primary":
        return [5, 2, 4, 1]
    if stage == "middle_school":
        return [7, 3, 5, 2, 6]
    return [9, 4, 7, 1, 6, 2]


def _read_stage(context: dict[str, Any]) -> StageRoute:
    value = context.get("stage")
    if isinstance(value, str) and value.strip() in _STAGE_ALIASES:
        return _STAGE_ALIASES[value.strip()]

    grade = context.get("grade")
    if isinstance(grade, str):
        if any(item in grade for item in ("一", "二", "三")) and "年级" in grade:
            return "lower_primary"
        if any(item in grade for item in ("四", "五", "六")) and "年级" in grade:
            return "upper_primary"
        if "高" in grade:
            return "high_school"
        if "初" in grade or any(item in grade for item in ("七", "八", "九")):
            return "middle_school"
    return "middle_school"


def _default_grade(stage: StageRoute) -> str:
    defaults = {
        "lower_primary": "小学二年级",
        "upper_primary": "小学六年级",
        "middle_school": "初中八年级",
        "high_school": "高中一年级",
    }
    return defaults[stage]


def _read_topic(context: dict[str, Any], input_text: str) -> str:
    value = _read_text(context, "topic", "")
    if value:
        return value
    if "冒泡" in input_text or "排序" in input_text:
        return "冒泡排序"
    # 第一版工作流只实现经过验收的冒泡排序内容，不假装支持任意主题。
    return "冒泡排序"


def _read_text(context: dict[str, Any], key: str, default: str) -> str:
    value = context.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _read_text_list(context: dict[str, Any], key: str) -> list[str]:
    value = context.get(key, [])
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]
