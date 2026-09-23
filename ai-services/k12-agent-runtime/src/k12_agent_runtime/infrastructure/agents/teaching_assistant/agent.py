import re
from dataclasses import replace
from uuid import uuid4

from k12_agent_runtime.application.rag import SearchKnowledgeUseCase
from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.infrastructure.agents.teaching_assistant.graph import (
    build_teaching_assistant_graph,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.state import (
    TeachingAssistantState,
)


class TeachingAssistantAgent:
    """将 AI 通识教学 LangGraph 适配成平台统一 AgentExecutor。"""

    def __init__(
        self,
        chat_model: ChatModel | None = None,
        search_knowledge: SearchKnowledgeUseCase | None = None,
        rag_candidate_count: int = 20,
        rag_top_k: int = 5,
    ) -> None:
        # 图结构固定，只在容器启动时编译一次。
        self._graph = build_teaching_assistant_graph(
            chat_model,
            search_knowledge,
            rag_candidate_count,
            rag_top_k,
        )

    @property
    def code(self) -> str:
        return "teaching-assistant"

    @property
    def description(self) -> str:
        return "按学段讲解 AI 通识主题，并展示结构化步骤或固定答案的练习。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        initial_state: TeachingAssistantState = {"run_input": run_input}
        final_state = await self._graph.ainvoke(initial_state)

        artifacts: list[AgentArtifact] = []
        if animation := final_state.get("animation_payload"):
            mime_type = (
                "application/vnd.k12.lesson-steps.v1+json"
                if animation.get("animationType") == "lesson-steps"
                else "application/vnd.k12.animation.v1+json"
            )
            artifacts.append(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.ANIMATION,
                    mime_type=mime_type,
                    title=animation["title"],
                    payload=animation,
                )
            )
        if quiz := final_state.get("quiz_payload"):
            artifacts.append(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.GAME,
                    mime_type="application/vnd.k12.quiz.v1+json",
                    title=quiz["title"],
                    payload=quiz,
                )
            )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=final_state["output_text"],
            artifacts=tuple(artifacts),
            metadata=final_state["metadata"],
        )


class LowerPrimaryTutorAgent(TeachingAssistantAgent):
    """小学低年级专属入口；复用教学图，但强制低龄策略与受控交互。"""

    @property
    def code(self) -> str:
        return "lower-primary-tutor"

    @property
    def description(self) -> str:
        return "面向小学低年级的短句、绘本、图片任务与即时反馈教学智能体。"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        context = dict(run_input.context)
        context["stage"] = "lower_primary"
        context["audiencePolicy"] = "lower-primary"
        context["preferredInteraction"] = ["互动绘本", "图片选择", "短句讲解"]
        scoped_input = replace(run_input, agent_code=self.code, context=context)
        result = await super().invoke(scoped_input)
        return self._build_guided_result(result, context)

    def _build_guided_result(
        self,
        result: AgentRunResult,
        context: dict[str, object],
    ) -> AgentRunResult:
        """把通用教学图输出收敛为低龄端可稳定渲染的短轮次协议。"""
        turn_index = self._conversation_turn_count(context)
        phase_index = min(turn_index, 2)
        phase = ("LOOK", "THINK", "TRY")[phase_index]
        metadata = dict(result.metadata)
        topic = str(metadata.get("topic") or "今天的 AI 小发现")
        quiz_question, quiz_choices = self._first_quiz_prompt(result.artifacts)

        if phase == "LOOK":
            detail = self._section_text(result.output_text, "概念解释")
            prompt = quiz_question or "你觉得机器会先观察什么线索？"
            choices = quiz_choices or [
                {"id": "shape", "label": "形状", "value": "我觉得机器会先看形状。"},
                {"id": "color", "label": "颜色", "value": "我觉得机器会先看颜色。"},
                {"id": "both", "label": "一起看", "value": "我觉得形状和颜色都要看。"},
            ]
            output_text = f"### {topic}\n\n{detail}\n\n**{prompt}**"
            encouragement = "先观察，再大胆猜一猜。"
        elif phase == "THINK":
            detail = self._section_text(result.output_text, "互动示例")
            prompt = "你想用哪种方式继续发现？"
            choices = [
                {"id": "example", "label": "看一个例子", "value": "请再给我看一个简单例子。"},
                {"id": "guess", "label": "我来猜一猜", "value": "我想自己猜一猜。"},
                {"id": "simpler", "label": "再简单一点", "value": "请用更简单的短句再讲一次。"},
            ]
            output_text = f"### 找到一个新线索\n\n{detail}\n\n**{prompt}**"
            encouragement = "你的想法很重要，我们再走一小步。"
        else:
            detail = self._section_text(result.output_text, "理解检查")
            prompt = "准备好完成今天的小挑战了吗？"
            choices = [
                {"id": "challenge", "label": "开始小挑战", "value": "我准备好开始小挑战了。"},
                {"id": "story", "label": "再听一个故事", "value": "我想先听一个相关的小故事。"},
                {"id": "question", "label": "我还有问题", "value": "我还有一个问题想问。"},
            ]
            output_text = f"### 做得真棒\n\n{detail}\n\n**{prompt}**"
            encouragement = "答错也没关系，小智会陪你一起找答案。"

        metadata["workflow"] = "lower-primary-guided-v1"
        metadata["guidedConversation"] = {
            "schemaVersion": "1.0",
            "mode": "SHORT_TURN",
            "phase": phase,
            "turnIndex": turn_index,
            "prompt": prompt,
            "choices": choices[:3],
            "showPractice": phase == "TRY",
            "progressCurrent": phase_index + 1,
            "progressTotal": 3,
            "encouragement": encouragement,
        }
        return replace(result, output_text=output_text, metadata=metadata)

    @staticmethod
    def _conversation_turn_count(context: dict[str, object]) -> int:
        conversation = context.get("conversation")
        if isinstance(conversation, dict):
            value = conversation.get("previousTurnCount")
            if isinstance(value, int) and value >= 0:
                return value
        history = context.get("conversationHistory")
        return len(history) if isinstance(history, list) else 0

    @staticmethod
    def _first_quiz_prompt(
        artifacts: tuple[AgentArtifact, ...],
    ) -> tuple[str | None, list[dict[str, str]]]:
        for artifact in artifacts:
            if artifact.kind is not AgentArtifactKind.GAME:
                continue
            questions = artifact.payload.get("questions", [])
            if not isinstance(questions, list) or not questions:
                continue
            question = questions[0]
            if not isinstance(question, dict):
                continue
            prompt = str(question.get("prompt") or "").strip() or None
            choices: list[dict[str, str]] = []
            options = question.get("options", [])
            if isinstance(options, list):
                for option in options[:3]:
                    if not isinstance(option, dict):
                        continue
                    label = str(option.get("text") or "").strip()
                    if not label:
                        continue
                    choices.append(
                        {
                            "id": str(option.get("id") or len(choices) + 1),
                            "label": label,
                            "value": label,
                        }
                    )
            return prompt, choices
        return None, []

    @staticmethod
    def _section_text(markdown: str, heading: str, limit: int = 120) -> str:
        match = re.search(
            rf"###\s+{re.escape(heading)}\s*(.*?)(?=\n###\s+|\Z)",
            markdown,
            flags=re.DOTALL,
        )
        text = match.group(1) if match else markdown
        text = "\n".join(
            line for line in text.splitlines() if not line.strip().startswith("|")
        )
        text = re.sub(r"[*_`#>|]", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            return "我们先看一看，再说出自己发现的线索。"
        if len(text) <= limit:
            return text
        short = text[:limit]
        for marker in ("。", "！", "？"):
            end = short.rfind(marker)
            if end >= 40:
                return short[: end + 1]
        return f"{short.rstrip('，,；;：:')}……"
