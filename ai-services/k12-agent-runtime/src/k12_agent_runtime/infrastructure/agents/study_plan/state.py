from typing import Any, NotRequired, TypedDict

from k12_agent_runtime.domain.agents.models import AgentRunInput


class StudyPlanStep(TypedDict):
    """学习计划表格中的一行。"""

    stage: str
    minutes: int
    task: str


class StudyPlanState(TypedDict):
    """LangGraph中所有节点共享的状态。

    LangGraph节点不会通过位置参数彼此传值，而是读取State并返回部分State更新。
    `run_input` 是图启动时必须传入的值；其他字段由不同节点逐步补充，所以使用
    NotRequired标记。
    """

    run_input: AgentRunInput
    topic: NotRequired[str]
    grade: NotRequired[str]
    duration_minutes: NotRequired[int]
    weak_points: NotRequired[list[str]]
    strategy: NotRequired[str]
    plan: NotRequired[list[StudyPlanStep]]
    output_text: NotRequired[str]
    metadata: NotRequired[dict[str, Any]]
