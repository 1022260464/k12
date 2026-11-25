import re
from dataclasses import replace
from uuid import uuid4

from k12_agent_runtime.application.courseware import GenerateCoursewareUseCase
from k12_agent_runtime.application.courseware import GenerateCoursewareUseCase
from k12_agent_runtime.application.rag import SearchKnowledgeUseCase
from k12_agent_runtime.domain.agents.models import (
    AgentArtifact,
    AgentArtifactKind,
    AgentRunInput,
    AgentRunResult,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.domain.llm.models import ChatMessage, ChatRequest
from k12_agent_runtime.infrastructure.agents.teaching_assistant.graph import (
    build_teaching_assistant_graph,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.state import (
    TeachingAssistantState,
)
from k12_agent_runtime.infrastructure.agents.teaching_assistant.topics import (
    Topic,
    lesson_for,
    resolve_topic,
)


class TeachingAssistantAgent:
    """将 AI 通识教学 LangGraph 适配成平台统一 AgentExecutor。"""

    def __init__(
        self,
        chat_model: ChatModel | None = None,
        search_knowledge: SearchKnowledgeUseCase | None = None,
        rag_candidate_count: int = 20,
        rag_top_k: int = 5,
        generate_courseware: GenerateCoursewareUseCase | None = None,
    ) -> None:
        # 图结构固定，只在容器启动时编译一次。
        self._chat_model = chat_model
        self._generate_courseware = generate_courseware
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
        if "课件" in (run_input.input_text or ""):
            courseware = await self._courseware_turn(run_input)
            if courseware is not None:
                return courseware
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

    async def _courseware_turn(self, run_input: AgentRunInput) -> AgentRunResult | None:
        """「做一个课件」旁路：生成失败时返回 None 走原对话兜底。"""
        if self._generate_courseware is None:
            return None
        context = dict(run_input.context)
        stage = str(context.get("stage") or "lower_primary")
        try:
            document = await self._generate_courseware.execute(
                run_input.input_text or "",
                stage=stage,
                topic_code=context.get("topicCode"),
            )
        except (ValueError, RuntimeError):
            return None
        text = (
            "课件做好啦！点下面的卡片，跟小智一页一页学吧。"
            if self.code == "lower-primary-tutor"
            else f"《{document['title']}》已生成，点开下方课件卡片即可讲授。"
        )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=text,
            artifacts=(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.COURSEWARE,
                    mime_type="application/vnd.k12.courseware.v1+json",
                    title=document["title"],
                    payload=document,
                ),
            ),
            metadata={},
        )

    async def _courseware_turn(self, run_input: AgentRunInput) -> AgentRunResult | None:
        """「做一个课件」旁路：生成失败时返回 None 走原对话兜底。"""
        if self._generate_courseware is None:
            return None
        context = dict(run_input.context)
        stage = str(context.get("stage") or "lower_primary")
        try:
            document = await self._generate_courseware.execute(
                run_input.input_text or "",
                stage=stage,
                topic_code=context.get("topicCode"),
            )
        except (ValueError, RuntimeError):
            return None
        text = (
            "课件做好啦！点下面的卡片，跟小智一页一页学吧。"
            if self.code == "lower-primary-tutor"
            else f"《{document['title']}》已生成，点开下方课件卡片即可讲授。"
        )
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=text,
            artifacts=(
                AgentArtifact(
                    artifact_id=str(uuid4()),
                    kind=AgentArtifactKind.COURSEWARE,
                    mime_type="application/vnd.k12.courseware.v1+json",
                    title=document["title"],
                    payload=document,
                ),
            ),
            metadata={},
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
        special = await self._match_special_turn(scoped_input, context)
        if special is not None:
            return special
        result = await super().invoke(scoped_input)
        if result.metadata.get("topicSupported") is False:
            # 低龄自由提问不该被审定主题守卫拒之门外：儿童安全口吻直接回答，
            # 或对小挑战请求给出确定性邀请，避免重复同一张引导卡。
            text = scoped_input.input_text or ""
            if "挑战" in text:
                return self._guided_side_turn(
                    scoped_input, context, self._CHALLENGE_INVITE, False,
                    prompt="想好答案就告诉小智，或再听一个小故事！",
                    encouragement="大胆说出你的发现，小智很想听！",
                    phase="TRY",
                )
            answer, used_model = await self._answer_like_kid_friend(text)
            return self._guided_side_turn(
                scoped_input, context, answer, used_model,
                prompt="还想问什么？或者开始今天的小挑战！",
                encouragement="回答得真棒！有新问题随时问小智！",
            )
        return self._build_guided_result(result, context)

    _INVITE_TEXTS = frozenset({
        "我还有一个问题想问。",
        "我还有一个问题想问",
        "我还有问题",
        "我有问题",
        "我问个问题",
    })
    _CHALLENGE_INVITE = (
        "小挑战来啦：找一找你身边最『聪明』的东西——它能帮我们做什么？"
        "把你的发现说给小智听吧！"
    )
    # 「你是谁/你叫什么」这类身份问题不进教学图：硬套课程引导卡会答非所问。
    _IDENTITY_PATTERN = re.compile(
        r"你是谁|你叫什么|你的名字|怎么称呼你|你叫啥|你是机器人|你是AI|你是人工智能"
        r"|你是真人|你是人吗|你是电脑|你是程序|你是小智|你能做什么|你会什么|你是干嘛|你是做什么"
    )
    _IDENTITY_ANSWER = (
        "我是小智，一个陪你学 AI 的机器人朋友！"
        "我会讲 AI 小故事、出图片小挑战，还能回答你的『十万个为什么』。"
    )
    _STORY_SYSTEM = (
        "你是小学低年级的AI启蒙老师小智。请根据给定的课程内容讲一个儿童小故事："
        "主角是一个小朋友和一个可爱的机器人；不超过120字；全部使用口语化短句；"
        "故事要贴合课程内容；结尾用一个简短的问题引导孩子思考。"
    )
    _KID_ANSWER_SYSTEM = (
        "你是面向6-9岁小朋友的AI助手小智。请用不超过3句话、口语化短句回答孩子的问题；"
        "语气亲切正面，先直接给出答案；遇到危险、恐怖或成人内容时，"
        "温柔建议孩子去问家长或老师；不要讨论暴力等不适内容；不要编造课堂里没有的AI概念。"
    )

    async def _match_special_turn(
        self,
        run_input: AgentRunInput,
        context: dict[str, object],
    ) -> AgentRunResult | None:
        """引导卡按钮的固定话术在通用教学图里解析不出主题，需在此旁路处理。"""
        text = (run_input.input_text or "").strip()
        if not text:
            return None
        if "课件" in text:
            courseware = await self._courseware_turn(run_input)
            if courseware is not None:
                return courseware
        if "故事" in text and len(text) <= 30:
            return await self._story_turn(run_input, context)
        # 身份/能力类元问题：短句直接自我介绍，不走课程引导。
        if len(text) <= 30 and self._IDENTITY_PATTERN.search(text):
            return self._guided_side_turn(
                run_input, context, self._IDENTITY_ANSWER, False,
                prompt="接下来想听故事、玩挑战，还是问问题呀？",
                topic_title="小智是谁",
            )
        if text in self._INVITE_TEXTS:
            return self._guided_side_turn(
                run_input, context,
                "好呀！把你的问题打给小智，我会用最简单的话回答你。",
                False,
                prompt="你想问什么呀？直接打给小智吧！",
                encouragement="想问什么都可以，小智认真听！",
            )
        return None

    async def _story_turn(
        self,
        run_input: AgentRunInput,
        context: dict[str, object],
    ) -> AgentRunResult:
        context_topic = (
            context.get("topicCode")
            or context.get("knowledgeCode")
            or context.get("topic")
        )
        topic = resolve_topic(run_input.input_text, context_topic)
        lesson = None
        if isinstance(topic, Topic):
            topic_title = topic.title
            topic_code: str | None = topic.code
            lesson = lesson_for(topic, "lower_primary")
        elif isinstance(topic, str):
            topic_title = str(context_topic or topic)
            topic_code = topic
        else:
            topic_title = ""
            topic_code = None
        story, used_model = await self._compose_story(run_input.input_text, topic_title, lesson)
        return self._guided_side_turn(
            run_input, context, story, used_model,
            prompt="想再听一个故事，还是开始今天的小挑战？",
            topic_title=topic_title,
            topic_code=topic_code,
            encouragement="喜欢这个故事的话，就再听一个吧！",
        )

    async def _compose_story(
        self,
        request_text: str,
        topic_title: str,
        lesson: dict[str, str] | None,
    ) -> tuple[str, bool]:
        fallback = self._fallback_story(topic_title, lesson)
        if self._chat_model is None:
            return fallback, False
        context_bits = []
        if topic_title:
            context_bits.append(f"主题：{topic_title}")
        if lesson:
            context_bits.append(
                f"内容要点：{lesson.get('explanation', '')} 例子：{lesson.get('example', '')}"
            )
        context_bits.append(f"孩子说：{request_text}")
        try:
            response = await self._chat_model.complete(ChatRequest(
                messages=(
                    ChatMessage(role="system", content=self._STORY_SYSTEM),
                    ChatMessage(role="user", content="\n".join(context_bits)),
                ),
                temperature=0.6,
                max_output_tokens=400,
            ))
            story = (response.content or "").strip()
        except Exception:
            return fallback, False
        return (story or fallback), bool(story)

    @staticmethod
    def _fallback_story(topic_title: str, lesson: dict[str, str] | None) -> str:
        title = topic_title or "今天的AI小发现"
        example = (lesson or {}).get("example") or "机器人豆豆认真观察身边的图案，一步一步学了起来"
        return (
            f"小明和机器人豆豆一起研究「{title}」。{example}。"
            "豆豆眨眨眼问：你发现其中的小秘密了吗？"
        )

    async def _answer_like_kid_friend(self, question_text: str) -> tuple[str, bool]:
        fallback = (
            "这个问题真有意思！小智更擅长陪你发现身边的小秘密，"
            "也可以把这个问题讲给爸爸妈妈或老师听一听。"
        )
        if self._chat_model is None:
            return fallback, False
        try:
            response = await self._chat_model.complete(ChatRequest(
                messages=(
                    ChatMessage(role="system", content=self._KID_ANSWER_SYSTEM),
                    ChatMessage(role="user", content=question_text or "你好"),
                ),
                temperature=0.4,
                max_output_tokens=300,
            ))
            answer = (response.content or "").strip()
        except Exception:
            return fallback, False
        return (answer or fallback), bool(answer)

    def _guided_side_turn(
        self,
        run_input: AgentRunInput,
        context: dict[str, object],
        body_text: str,
        used_model: bool,
        prompt: str,
        topic_title: str = "",
        topic_code: str | None = None,
        encouragement: str = "有新想法随时告诉小智！",
        phase: str = "CHAT",
    ) -> AgentRunResult:
        """故事/自由问答轮次：沿用引导卡协议，保证前端可继续交互。

        这些轮次没有真正待作答的题目，鼓励语必须贴合语境
        （提问邀请、听故事、自由问答），不能再复用 TRY 挑战卡的
        "答错也没关系"；phase 用 CHAT 让前端标题回落为"一起学"。
        """
        choices = [
            {"id": "story", "label": "再听一个故事", "value": "我想再听一个小故事。"},
            {"id": "challenge", "label": "开始小挑战", "value": "我准备好开始小挑战了。"},
            {"id": "question", "label": "我还有问题", "value": "我还有一个问题想问。"},
        ]
        guided_conversation = {
            "schemaVersion": "1.0",
            "mode": "SHORT_TURN",
            "phase": phase,
            "turnIndex": self._conversation_turn_count(context),
            "prompt": prompt,
            "choices": choices,
            "showPractice": False,
            "progressCurrent": 3,
            "progressTotal": 3,
            "encouragement": encouragement,
        }
        metadata = {
            "implementation": "deterministic-langgraph",
            "workflow": "lower-primary-guided-v1",
            "domain": "ai-literacy",
            "stage": "小学低年级",
            "stageCode": "lower_primary",
            "topicSupported": True,
            "topic": topic_title or None,
            "topicCode": topic_code,
            "generatedInteractions": [],
            "modelUsed": used_model,
            "ragRetrieved": False,
            "modelFallbackReason": "not_applicable",
            "guidedConversation": guided_conversation,
        }
        output_text = f"### {topic_title or '小智陪你聊'}\n\n{body_text}\n\n**{prompt}**"
        return AgentRunResult(
            run_id=run_input.run_id,
            agent_code=self.code,
            status=AgentRunStatus.SUCCEEDED,
            output_text=output_text,
            artifacts=(),
            metadata=metadata,
        )

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
        quiz_question, quiz_choices, quiz_visual = self._first_quiz_prompt(result.artifacts)

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
        guided_conversation = {
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
        if quiz_visual:
            guided_conversation["visual"] = quiz_visual
        metadata["guidedConversation"] = guided_conversation
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
    ) -> tuple[str | None, list[dict[str, str]], dict[str, str] | None]:
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
            visual = question.get("visual")
            visual = dict(visual) if isinstance(visual, dict) and visual.get("value") else None
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
            return prompt, choices, visual
        return None, [], None

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
