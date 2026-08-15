from uuid import uuid4

from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)


class DemoChartAgent:
    """Small deterministic agent used to verify frontend artifact rendering."""

    @property
    def code(self) -> str:
        return "demo-chart"

    @property
    def description(self) -> str:
        return "Returns text plus a Vega-Lite chart artifact."

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        chart = AgentArtifact(
            artifact_id=str(uuid4()),
            kind=AgentArtifactKind.CHART,
            mime_type="application/vnd.vegalite.v5+json",
            title="学习时长示例",
            payload={
                "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
                "data": {
                    "values": [
                        {"day": "Mon", "minutes": 25},
                        {"day": "Tue", "minutes": 40},
                        {"day": "Wed", "minutes": 32},
                        {"day": "Thu", "minutes": 55},
                        {"day": "Fri", "minutes": 48},
                    ]
                },
                "mark": {"type": "bar", "tooltip": True},
                "encoding": {
                    "x": {"field": "day", "type": "ordinal", "title": "日期"},
                    "y": {
                        "field": "minutes",
                        "type": "quantitative",
                        "title": "学习时长（分钟）",
                    },
                },
            },
        )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=f"已收到任务：{run_input.input_text}",
            artifacts=(chart,),
            metadata={"implementation": "demo"},
        )
