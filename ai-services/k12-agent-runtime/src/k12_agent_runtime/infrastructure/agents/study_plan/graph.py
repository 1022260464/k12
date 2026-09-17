from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from k12_agent_runtime.infrastructure.agents.study_plan.nodes import (
    build_general_plan,
    build_targeted_plan,
    compose_response,
    normalize_input,
    route_plan,
)
from k12_agent_runtime.infrastructure.agents.study_plan.state import StudyPlanState


def build_study_plan_graph() -> CompiledStateGraph:
    """构建并编译学习计划LangGraph。

    复习要点：
    - StateGraph：图的构建器，泛型参数是共享State结构。
    - Node：普通Python函数，签名通常是 State -> Partial[State]。
    - Edge：决定节点执行顺序；条件边可以根据State选择分支。
    - START/END：LangGraph提供的虚拟起点和终点。
    - compile：完成结构检查并生成可以invoke/ainvoke的可执行图。
    """
    builder = StateGraph(StudyPlanState)

    # 节点名是图内部稳定标识；节点函数负责实际处理。
    builder.add_node("normalize_input", normalize_input)
    builder.add_node("build_targeted_plan", build_targeted_plan)
    builder.add_node("build_general_plan", build_general_plan)
    builder.add_node("compose_response", compose_response)

    # 固定边：图从输入标准化节点开始。
    builder.add_edge(START, "normalize_input")

    # 条件边：route_plan返回标签，再通过字典映射到真正节点。
    builder.add_conditional_edges(
        "normalize_input",
        route_plan,
        {
            "targeted": "build_targeted_plan",
            "general": "build_general_plan",
        },
    )

    # 两条分支最终汇合到统一响应节点。
    builder.add_edge("build_targeted_plan", "compose_response")
    builder.add_edge("build_general_plan", "compose_response")
    builder.add_edge("compose_response", END)

    # StateGraph只是构建器，必须compile后才能执行。
    return builder.compile(name="k12-study-plan")
