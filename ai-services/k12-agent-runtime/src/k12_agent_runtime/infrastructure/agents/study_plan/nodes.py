from typing import Any, Literal

from k12_agent_runtime.infrastructure.agents.study_plan.state import (
    StudyPlanState,
    StudyPlanStep,
)


def normalize_input(state: StudyPlanState) -> dict[str, Any]:
    """节点一：清洗Agent输入，并写入后续节点需要的标准字段。

    节点只返回发生变化的字段，不需要复制整个State。LangGraph会把返回值合并回共享
    State。未来可以在这里增加Pydantic校验，但不要在节点中读取数据库或创建SDK客户端。
    """
    run_input = state["run_input"]
    return {
        "topic": run_input.input_text.strip(),
        "grade": _read_text(run_input.context, "grade", "未指定年级"),
        "duration_minutes": _read_duration(run_input.context),
        "weak_points": _read_weak_points(run_input.context),
    }


def route_plan(state: StudyPlanState) -> Literal["targeted", "general"]:
    """条件路由：有薄弱点时走针对性计划，否则走通用计划。

    路由函数不修改State，只返回一个路由标签。`graph.py` 会把标签映射到实际节点名。
    """
    return "targeted" if state["weak_points"] else "general"


def build_targeted_plan(state: StudyPlanState) -> dict[str, Any]:
    """节点二A：根据薄弱点生成针对性学习计划。"""
    return {
        "strategy": "targeted",
        "plan": _build_plan(
            topic=state["topic"],
            duration_minutes=state["duration_minutes"],
            weak_points=state["weak_points"],
        ),
    }


def build_general_plan(state: StudyPlanState) -> dict[str, Any]:
    """节点二B：没有薄弱点时生成通用学习计划。"""
    return {
        "strategy": "general",
        "plan": _build_plan(
            topic=state["topic"],
            duration_minutes=state["duration_minutes"],
            weak_points=[],
        ),
    }


def compose_response(state: StudyPlanState) -> dict[str, Any]:
    """节点三：把图中的业务状态整理成最终文字和元数据。

    当前节点使用模板生成文字。接入大模型后，可以将这里或两个计划节点替换为异步LLM
    节点，但图的入口、分支和结束节点可以保持不变。
    """
    weak_points = state["weak_points"]
    weak_point_text = "、".join(weak_points) if weak_points else "暂无"
    return {
        "output_text": (
            f"已为{state['grade']}生成“{state['topic']}”学习计划，"
            f"总时长{state['duration_minutes']}分钟。当前重点：{weak_point_text}。"
        ),
        "metadata": {
            "implementation": "langgraph-example",
            "workflow": "study-plan-v1",
            "strategy": state["strategy"],
            "grade": state["grade"],
            "durationMinutes": state["duration_minutes"],
            "weakPoints": weak_points,
        },
    }


def _build_plan(
    topic: str,
    duration_minutes: int,
    weak_points: list[str],
) -> list[StudyPlanStep]:
    """确定性示例逻辑；未来可替换为模型、RAG或教学策略工具调用。"""
    durations = _allocate_duration(duration_minutes)
    focus = "、".join(weak_points) if weak_points else topic
    return [
        {
            "stage": "目标确认",
            "minutes": durations[0],
            "task": f"明确{topic}的学习目标，回忆已掌握内容。",
        },
        {
            "stage": "知识学习",
            "minutes": durations[1],
            "task": f"学习{topic}的核心概念，并整理关键公式或知识点。",
        },
        {
            "stage": "针对练习",
            "minutes": durations[2],
            "task": f"围绕{focus}完成分层练习，记录错误原因。",
        },
        {
            "stage": "总结复盘",
            "minutes": durations[3],
            "task": "订正错题，用自己的话总结本次学习内容。",
        },
    ]


def _allocate_duration(total: int) -> tuple[int, int, int, int]:
    """按比例分配时间，并确保各阶段之和严格等于总时长。"""
    first = round(total * 0.15)
    second = round(total * 0.35)
    third = round(total * 0.35)
    fourth = total - first - second - third
    return first, second, third, fourth


def _read_text(context: dict[str, Any], key: str, default: str) -> str:
    value = context.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _read_duration(context: dict[str, Any]) -> int:
    value = context.get("durationMinutes", 45)
    # bool是int的子类，需要单独排除，避免true被当成1分钟。
    if isinstance(value, bool) or not isinstance(value, int):
        return 45
    return min(max(value, 20), 180)


def _read_weak_points(context: dict[str, Any]) -> list[str]:
    value = context.get("weakPoints", [])
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]
