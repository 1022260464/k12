from __future__ import annotations

import asyncio

import pytest

from k12_agent_runtime.application.rag import SearchKnowledgeCommand
from k12_agent_runtime.domain.agents.models import (
    AgentArtifactKind,
    AgentRunInput,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatRequest, ChatResponse
from k12_agent_runtime.domain.rag import KnowledgeSearchResult, RankedDocument
from k12_agent_runtime.infrastructure.agents.teaching_assistant import (
    LowerPrimaryTutorAgent,
    TeachingAssistantAgent,
)


def run_agent(context: dict[str, object]):
    agent = TeachingAssistantAgent()
    return asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-teaching-1",
                agent_code="teaching-assistant",
                input_text="为什么冒泡排序要比较旁边的数字？",
                user_id="student-1",
                context=context,
            )
        )
    )


def run_topic(question: str, context: dict[str, object]):
    return asyncio.run(
        TeachingAssistantAgent().invoke(
            AgentRunInput(
                run_id="run-topic-1",
                agent_code="teaching-assistant",
                input_text=question,
                user_id="student-1",
                context=context,
            )
        )
    )


def test_lower_primary_tutor_has_separate_code_and_enforces_child_policy() -> None:
    result = asyncio.run(
        LowerPrimaryTutorAgent().invoke(
            AgentRunInput(
                run_id="run-lower-primary-1",
                agent_code="lower-primary-tutor",
                input_text="继续讲图像分类",
                user_id="student-1",
                context={
                    "stage": "high_school",
                    "topicCode": "machine_learning.image_classification",
                },
            )
        )
    )

    assert result.agent_code == "lower-primary-tutor"
    assert result.metadata["stageCode"] == "lower_primary"
    assert result.metadata["topicCode"] == "machine_learning.image_classification"
    assert result.metadata["workflow"] == "lower-primary-guided-v1"
    guided = result.metadata["guidedConversation"]
    assert guided["mode"] == "SHORT_TURN"
    assert guided["phase"] == "LOOK"
    assert guided["progressCurrent"] == 1
    assert guided["showPractice"] is False
    assert 1 <= len(guided["choices"]) <= 3
    assert "### 概念解释" not in result.output_text
    assert "图片里的线索" in result.output_text or "猫和狗" in result.output_text


@pytest.mark.parametrize(
    ("previous_turn_count", "phase", "progress", "show_practice"),
    [
        (1, "THINK", 2, False),
        (2, "TRY", 3, True),
        (7, "TRY", 3, True),
    ],
)
def test_lower_primary_tutor_advances_short_guided_turns(
    previous_turn_count: int,
    phase: str,
    progress: int,
    show_practice: bool,
) -> None:
    result = asyncio.run(
        LowerPrimaryTutorAgent().invoke(
            AgentRunInput(
                run_id=f"run-lower-primary-{previous_turn_count}",
                agent_code="lower-primary-tutor",
                input_text="我想继续学",
                user_id="student-1",
                context={
                    "topicCode": "machine_learning.image_classification",
                    "conversation": {"previousTurnCount": previous_turn_count},
                },
            )
        )
    )

    guided = result.metadata["guidedConversation"]
    assert guided["phase"] == phase
    assert guided["progressCurrent"] == progress
    assert guided["showPractice"] is show_practice
    assert guided["progressTotal"] == 3
    assert len(guided["choices"]) == 3
    assert all(choice["label"] for choice in guided["choices"])


def test_object_detection_is_a_reviewed_follow_up_topic() -> None:
    result = run_topic(
        "请继续讲物体检测",
        {"stage": "lower_primary", "topicCode": "computer_vision.object_detection"},
    )

    assert result.metadata["topicSupported"] is True
    assert result.metadata["topicCode"] == "computer_vision.object_detection"
    assert result.artifacts


@pytest.mark.parametrize(
    ("question", "code"),
    [
        ("图像分类怎么学？", "machine_learning.image_classification"),
        ("生成式 AI 应该如何安全使用？", "generative_ai.responsible_use"),
        ("训练集和测试集有什么区别？", "machine_learning.train_test_split"),
        ("神经网络是什么？", "machine_learning.neural_network_basics"),
    ],
)
@pytest.mark.parametrize(
    "stage", ["lower_primary", "upper_primary", "middle_school", "high_school"]
)
def test_new_topics_provide_stage_specific_lesson_and_recorded_practice(
    question: str, code: str, stage: str
) -> None:
    result = run_topic(question, {"stage": stage})

    assert result.status is AgentRunStatus.SUCCEEDED
    assert result.metadata["topicCode"] == code
    assert result.metadata["stageCode"] == stage
    assert result.metadata["generatedInteractions"] == [
        "ANIMATION",
        "GAME",
        "UNDERSTANDING_CHECK",
    ]
    assert "### 概念解释" in result.output_text
    assert "冒泡排序" not in result.output_text
    assert "下方动画" not in result.output_text
    assert "按下方步骤" in result.output_text
    assert len(result.artifacts) == 2
    steps, quiz = result.artifacts
    assert steps.kind is AgentArtifactKind.ANIMATION
    assert steps.mime_type == "application/vnd.k12.lesson-steps.v1+json"
    assert steps.payload["animationType"] == "lesson-steps"
    assert 3 <= len(steps.payload["steps"]) <= 6
    assert quiz.kind is AgentArtifactKind.GAME
    assert quiz.payload["knowledgeCode"] == code
    assert quiz.payload["scoringMode"] == "RECORDED_PRACTICE"
    expected_count = 3 if code == "machine_learning.image_classification" and stage == "lower_primary" else 2
    assert quiz.payload["maxScore"] == expected_count * 10
    assert len(quiz.payload["questions"]) == expected_count
    if expected_count == 3:
        assert quiz.payload["questions"][0]["visual"] == {
            "kind": "emoji",
            "value": "🐱",
            "alt": "一只小猫",
        }
        assert quiz.payload["questions"][2]["correctOptionId"] == "check"
        assert quiz.payload["questions"][0]["errorType"] == "LABEL_MISMATCH"
        assert quiz.payload["questions"][2]["errorType"] == "UNCERTAINTY_HANDLING"
        assert all(question["hint"] for question in quiz.payload["questions"])


def test_new_topic_mastery_selects_reinforcement_and_extension() -> None:
    code = "machine_learning.image_classification"
    weak = run_topic(
        "图像分类是什么？",
        {
            "stage": "high_school",
            "knowledgeMastery": [{"knowledgeCode": code, "masteryPercent": 40}],
        },
    )
    strong = run_topic(
        "图像分类是什么？",
        {
            "stage": "high_school",
            "knowledgeMastery": [{"knowledgeCode": code, "masteryPercent": 85}],
        },
    )

    weak_quiz = next(item for item in weak.artifacts if item.kind is AgentArtifactKind.GAME)
    strong_quiz = next(
        item for item in strong.artifacts if item.kind is AgentArtifactKind.GAME
    )
    assert weak_quiz.payload["practiceLevel"] == "REINFORCE"
    assert "不同光线和背景" in weak_quiz.payload["questions"][0]["options"][1]["text"]
    assert strong_quiz.payload["practiceLevel"] == "EXTEND"
    assert strong_quiz.payload["maxScore"] == 30
    assert strong.metadata["knowledgeMasteryPercent"] == 85


@pytest.mark.parametrize(
    ("question", "code"),
    [
        ("Embedding 向量表示是什么？", "machine_learning.embedding_intro"),
        ("RAG 检索增强生成怎么工作？", "generative_ai.rag_basics"),
        ("AI 智能体怎样使用目标、工具和反馈？", "generative_ai.agents_basics"),
    ],
)
def test_high_school_trustworthy_ai_course_topics_are_stable_and_gradable(
    question: str, code: str
) -> None:
    result = run_topic(question, {"stage": "high_school", "preferDeterministic": True})

    assert result.status is AgentRunStatus.SUCCEEDED
    assert result.metadata["topicCode"] == code
    assert result.metadata["stageCode"] == "high_school"
    quiz = next(item for item in result.artifacts if item.kind is AgentArtifactKind.GAME)
    assert quiz.payload["knowledgeCode"] == code
    assert quiz.payload["scoringMode"] == "RECORDED_PRACTICE"
    assert len(quiz.payload["questions"]) == 2


def test_unknown_topic_does_not_generate_mislabeled_lesson_or_artifacts() -> None:
    result = run_topic("量子纠缠是什么？", {"stage": "middle_school"})

    assert result.metadata["topicSupported"] is False
    assert result.metadata["generatedInteractions"] == []
    assert result.artifacts == ()
    assert "目前支持" not in result.output_text
    assert "冒泡排序、选择排序、图像分类" in result.output_text or "审定主题" in result.output_text


def test_explicit_question_takes_precedence_over_stale_context_topic() -> None:
    result = run_topic("图像分类怎么训练？", {"topic": "冒泡排序"})

    assert result.metadata["topicCode"] == "machine_learning.image_classification"
    assert len(result.artifacts) == 2


def test_new_unknown_definition_does_not_reuse_stale_context_topic() -> None:
    result = run_topic("量子纠缠是什么？", {"topic": "冒泡排序"})

    assert result.metadata["topicSupported"] is False
    assert result.artifacts == ()


def test_follow_up_after_unsupported_topic_does_not_select_listed_topic() -> None:
    result = run_topic("继续", {
        "conversationHistory": [{
            "user": "量子纠缠是什么？",
            "assistant": (
                "当前教学助手支持多类审定主题：算法入门与排序可视化、机器学习、生成式 AI 与安全等。"
            ),
        }],
    })

    assert result.metadata["topicSupported"] is False
    assert result.artifacts == ()


def test_selection_sort_emits_deterministic_animation_and_quiz() -> None:
    result = run_topic("选择排序怎么做？", {"stage": "upper_primary"})

    assert result.metadata["topicCode"] == "sorting.selection_sort"
    assert result.metadata["topic"] == "选择排序"
    assert result.metadata["generatedInteractions"] == [
        "ANIMATION",
        "GAME",
        "UNDERSTANDING_CHECK",
    ]
    animation, quiz = result.artifacts
    assert animation.payload["animationType"] == "selection-sort"
    assert animation.payload["steps"][0]["action"] == "compare"
    assert quiz.payload["knowledgeCode"] == "sorting.selection_sort"
    assert "下方动画" in result.output_text


@pytest.mark.parametrize(
    ("question", "topic_code", "animation_type", "first_action"),
    [
        ("插入排序怎么做？", "sorting.insertion_sort", "insertion-sort", "compare"),
        ("线性查找怎么做？", "searching.linear_search", "linear-search", "probe"),
        ("二分查找怎么做？", "searching.binary_search", "binary-search", "probe"),
    ],
)
def test_extended_visual_topics_emit_bar_animations(
    question: str, topic_code: str, animation_type: str, first_action: str
) -> None:
    result = run_topic(question, {"stage": "middle_school", "preferDeterministic": True})

    assert result.metadata["topicCode"] == topic_code
    assert result.metadata["modelUsed"] is False
    animation, quiz = result.artifacts
    assert animation.payload["animationType"] == animation_type
    assert animation.payload["steps"][0]["action"] == first_action
    assert quiz.payload["knowledgeCode"] == topic_code
    assert "下方动画" in result.output_text


def test_same_topic_follow_up_skips_repeat_animation() -> None:
    result = run_topic(
        "为什么第一轮结束后最大值会在最后？",
        {
            "stage": "middle_school",
            "preferDeterministic": True,
            "topic": "冒泡排序",
            "shownDemoTopics": ["sorting.bubble_sort"],
            "conversationHistory": [
                {
                    "user": "冒泡排序怎么做？",
                    "assistant": "【概念解释】\n冒泡排序会比较相邻数字。",
                }
            ],
        },
    )

    assert result.metadata["topicCode"] == "sorting.bubble_sort"
    assert result.metadata["demoOmitted"] is True
    assert result.artifacts == ()
    assert "上方对话里已有演示" in result.output_text
    assert "再演示一遍" in result.output_text


def test_different_preset_in_same_session_still_sends_animation() -> None:
    """同一会话换另一个预设主题：只要该主题尚未标记，仍完整下发动画。"""
    result = run_topic(
        "选择排序怎么做？",
        {
            "stage": "upper_primary",
            "preferDeterministic": True,
            "shownDemoTopics": ["sorting.bubble_sort"],
            "conversationHistory": [
                {
                    "user": "冒泡排序怎么做？",
                    "assistant": "【概念解释】\n冒泡排序会比较相邻数字。选择排序也不同。",
                }
            ],
        },
    )

    assert result.metadata["topicCode"] == "sorting.selection_sort"
    assert result.metadata["demoOmitted"] is False
    assert result.artifacts[0].kind is AgentArtifactKind.ANIMATION
    assert result.artifacts[0].payload["animationType"] == "selection-sort"


def test_explicit_replay_request_resends_animation() -> None:
    result = run_topic(
        "再演示一遍冒泡排序",
        {
            "stage": "upper_primary",
            "preferDeterministic": True,
            "shownDemoTopics": ["sorting.bubble_sort"],
            "conversationHistory": [
                {
                    "user": "冒泡排序怎么做？",
                    "assistant": "【概念解释】\n冒泡排序会比较相邻数字。",
                }
            ],
        },
    )

    assert result.metadata["demoOmitted"] is False
    assert result.artifacts[0].kind is AgentArtifactKind.ANIMATION
    assert result.artifacts[0].payload["animationType"] == "bubble-sort"


def test_lesson_activity_keeps_practice_artifact_when_topic_was_already_shown() -> None:
    result = run_topic(
        "继续学习图像分类",
        {
            "stage": "lower_primary",
            "preferDeterministic": True,
            "requirePracticeArtifact": True,
            "topicCode": "machine_learning.image_classification",
            "shownDemoTopics": ["machine_learning.image_classification"],
            "conversationHistory": [
                {
                    "user": "图像分类是什么？",
                    "assistant": "机器会观察图片里的线索。",
                }
            ],
        },
    )

    assert result.metadata["demoOmitted"] is False
    quiz = next(item for item in result.artifacts if item.kind is AgentArtifactKind.GAME)
    assert quiz.mime_type == "application/vnd.k12.quiz.v1+json"
    assert len(quiz.payload["questions"]) == 3


def test_catalog_preset_skips_model_and_uses_deterministic_steps() -> None:
    model = CatalogGuidedChatModel()
    result = asyncio.run(
        TeachingAssistantAgent(model).invoke(  # type: ignore[arg-type]
            AgentRunInput(
                run_id="run-catalog-preset",
                agent_code="teaching-assistant",
                input_text="图像分类怎么学？",
                context={"stage": "middle_school", "preferDeterministic": True},
            )
        )
    )

    assert model.calls == 0
    assert result.metadata["modelUsed"] is False
    assert result.metadata["modelFallbackReason"] == "catalog_preset"
    steps = next(
        item for item in result.artifacts if item.kind is AgentArtifactKind.ANIMATION
    )
    assert steps.mime_type == "application/vnd.k12.lesson-steps.v1+json"
    assert steps.payload["steps"][0]["label"] == "学习目标"
    assert "模型生成" not in result.output_text


def test_catalog_topic_model_emits_guided_lesson_steps() -> None:
    model = CatalogGuidedChatModel()
    result = asyncio.run(
        TeachingAssistantAgent(model).invoke(  # type: ignore[arg-type]
            AgentRunInput(
                run_id="run-catalog-guided",
                agent_code="teaching-assistant",
                input_text="图像分类怎么学？",
                context={"stage": "middle_school"},
            )
        )
    )

    assert model.calls == 1
    assert result.metadata["modelUsed"] is True
    steps = next(
        item for item in result.artifacts if item.kind is AgentArtifactKind.ANIMATION
    )
    assert steps.mime_type == "application/vnd.k12.lesson-steps.v1+json"
    assert steps.payload["steps"][0]["label"] == "看线索"
    assert "模型生成的适龄解释" in result.output_text


class CatalogGuidedChatModel:
    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, request: ChatRequest) -> ChatResponse:
        self.calls += 1
        assert request.json_response is True
        return ChatResponse(
            content=(
                '{"explanation":"模型生成的适龄解释",'
                '"example":"模型生成的例子。",'
                '"understanding_check":"你能说出分类依据吗？",'
                '"next_step":"先看步骤，再完成小测。",'
                '"steps":['
                '{"label":"看线索","detail":"先观察图片里的耳朵和脸。"},'
                '{"label":"做判断","detail":"根据线索猜测图片类别。"},'
                '{"label":"再核对","detail":"用新图片检查判断是否可靠。"}'
                "]}"
            ),
            model="qwen-test",
            usage={},
        )


def test_recorded_practice_changes_next_deterministic_step() -> None:
    result = run_agent(
        {
            "stage": "middle_school",
            "recentPractice": [
                {"topic": "排序小测", "scorePercent": 50, "weakPoint": "相邻比较需要复习"}
            ],
            "knownWeakPoints": ["相邻比较需要复习"],
            "personalization": {"schemaVersion": "1.0", "practiceStatus": "LOADED"},
        }
    )

    assert "相邻比较需要复习" in result.output_text
    assert "复盘上次小测" in result.output_text
    assert result.metadata["personalization"]["recentPracticeCount"] == 1


class FakeChatModel:
    def __init__(self) -> None:
        self.last_request: ChatRequest | None = None

    async def complete(self, request: ChatRequest) -> ChatResponse:
        self.last_request = request
        assert request.json_response is True
        return ChatResponse(
            content=(
                '{"explanation":"模型生成的适龄解释",'
                '"example":"模型生成的例子。",'
                '"understanding_check":"你能解释相邻比较吗？",'
                '"next_step":"请先回答问题，再播放动画。"}'
            ),
            model="qwen-test",
            usage={"prompt_tokens": 20, "completion_tokens": 30, "ignored": "value"},
        )


class GroundedChatModel:
    def __init__(self, content: str | None = None) -> None:
        self.calls = 0
        self.content = content or (
            '{"learning_goal":"理解决策树如何按特征提问",'
            '"explanation":"决策树根据特征一步步提问，把样本分到不同叶子节点。",'
            '"example":"先问颜色，再问形状，最后得到类别。",'
            '"understanding_check":"为什么每一步只看一个特征？",'
            '"next_step":"逐步观察提问路径，再用自己的话复述。",'
            '"steps":[{"label":"准备输入","detail":"观察样本有哪些可提问的特征。"},'
            '{"label":"查看结果","detail":"沿着提问路径走到叶子并核对类别。"}]}'
        )

    async def complete(self, request: ChatRequest) -> ChatResponse:
        self.calls += 1
        assert request.json_response is True
        return ChatResponse(content=self.content, model="qwen-test", usage={})


def neural_network_source() -> FakeKnowledgeSearch:
    return FakeKnowledgeSearch((
        RankedDocument(
            document_id="decision-tree-001",
            text="决策树根据特征一步步提问，把样本分到不同叶子。",
            rerank_score=0.95,
            metadata={"title": "决策树入门", "sourceUri": "demo://decision-tree"},
        ),
    ))


def invoke_neural_network(model: GroundedChatModel | None, search: FakeKnowledgeSearch):
    agent = TeachingAssistantAgent(model, search)  # type: ignore[arg-type]
    return asyncio.run(agent.invoke(AgentRunInput(
        run_id="run-new-topic",
        agent_code="teaching-assistant",
        input_text="决策树是什么？",
        context={"stage": "high_school"},
    )))


def test_grounded_new_topic_emits_validated_generic_steps_without_code() -> None:
    model = GroundedChatModel()
    result = invoke_neural_network(model, neural_network_source())

    assert model.calls == 1
    assert result.metadata["topic"] == "决策树"
    assert result.metadata["topicCode"].startswith("knowledge.")
    assert result.metadata["ragUsed"] is True
    assert result.metadata["generatedInteractions"] == ["ANIMATION", "UNDERSTANDING_CHECK"]
    assert len(result.artifacts) == 1
    assert result.artifacts[0].mime_type == "application/vnd.k12.lesson-steps.v1+json"
    assert result.artifacts[0].payload["steps"][0]["label"] == "准备输入"
    assert "决策树" in result.output_text


def test_unrelated_source_cannot_authorize_dynamic_topic() -> None:
    model = GroundedChatModel()
    unrelated = FakeKnowledgeSearch((
        RankedDocument(
            document_id="sorting-001",
            text="冒泡排序比较相邻元素。",
            rerank_score=0.98,
            metadata={"title": "冒泡排序"},
        ),
    ))
    result = invoke_neural_network(model, unrelated)

    assert model.calls == 0
    assert result.artifacts == ()
    assert result.metadata["topicSupported"] is False


def test_dynamic_topic_needs_model_and_valid_schema() -> None:
    without_model = invoke_neural_network(None, neural_network_source())
    invalid = GroundedChatModel('{"explanation":"没有完整结构"}')
    without_schema = invoke_neural_network(invalid, neural_network_source())
    unsafe = GroundedChatModel(GroundedChatModel().content.replace(
        "准备输入", "<script>alert(1)</script>"
    ))
    without_plain_text = invoke_neural_network(unsafe, neural_network_source())

    assert without_model.artifacts == ()
    assert without_model.metadata["modelFallbackReason"] == "model_not_configured"
    assert without_schema.artifacts == ()
    assert without_schema.metadata["modelFallbackReason"] == "invalid_content"
    assert without_plain_text.artifacts == ()
    assert without_plain_text.metadata["modelFallbackReason"] == "invalid_content"


def test_generic_follow_up_without_topic_cannot_be_authorized_by_rag() -> None:
    model = GroundedChatModel()
    source = FakeKnowledgeSearch((
        RankedDocument(
            document_id="continue-001",
            text="继续学习决策树的提问与分支。",
            rerank_score=0.9,
            metadata={"title": "继续学习决策树"},
        ),
    ))
    result = asyncio.run(TeachingAssistantAgent(model, source).invoke(  # type: ignore[arg-type]
        AgentRunInput(run_id="generic", agent_code="teaching-assistant", input_text="继续")
    ))

    assert model.calls == 0
    assert result.artifacts == ()


class InvalidChatModel:
    async def complete(self, _request: ChatRequest) -> ChatResponse:
        return ChatResponse(content="不是JSON", model="qwen-test")


class FakeKnowledgeSearch:
    def __init__(self, documents: tuple[RankedDocument, ...]) -> None:
        self.documents = documents
        self.commands: list[SearchKnowledgeCommand] = []

    async def execute(self, command: SearchKnowledgeCommand) -> KnowledgeSearchResult:
        self.commands.append(command)
        return KnowledgeSearchResult(
            query=command.query,
            embedding_model="test-embedding",
            candidate_count=len(self.documents),
            documents=self.documents,
        )


class BrokenKnowledgeSearch:
    async def execute(self, _command: SearchKnowledgeCommand) -> KnowledgeSearchResult:
        raise RuntimeError("database password must not reach the Agent result")


def test_upper_primary_returns_versioned_animation() -> None:
    result = run_agent(
        {
            "stage": "小学高年级",
            "grade": "六年级",
            "topic": "冒泡排序",
            "knownWeakPoints": ["相邻比较"],
        }
    )

    assert result.status is AgentRunStatus.SUCCEEDED
    assert result.metadata["stage"] == "小学高年级"
    assert result.metadata["strategy"] == "analogy-and-steps"
    assert "相邻比较" in result.output_text
    assert "O(n²)" not in result.output_text

    artifact = result.artifacts[0]
    assert artifact.kind is AgentArtifactKind.ANIMATION
    assert artifact.mime_type == "application/vnd.k12.animation.v1+json"
    assert artifact.payload["animationType"] == "bubble-sort"
    assert artifact.payload["controls"] == ["play", "pause", "step", "restart"]
    assert artifact.payload["steps"][-1]["values"] == [1, 2, 4, 5]

    quiz = result.artifacts[1]
    assert quiz.kind is AgentArtifactKind.GAME
    assert quiz.mime_type == "application/vnd.k12.quiz.v1+json"
    assert quiz.payload["schemaVersion"] == "1.0"
    assert quiz.payload["gameType"] == "multiple-choice-quiz"
    assert quiz.payload["scoringMode"] == "RECORDED_PRACTICE"
    assert quiz.payload["knowledgeCode"] == "sorting.bubble_sort"
    assert quiz.payload["practiceLevel"] == "STANDARD"
    assert quiz.payload["maxScore"] == 20
    assert len(quiz.payload["questions"]) == 2


def test_mastery_adapts_question_difficulty() -> None:
    weak = (
        run_agent(
            {
                "stage": "high_school",
                "knowledgeMastery": [
                    {"knowledgeCode": "sorting.bubble_sort", "masteryPercent": 40}
                ],
            }
        )
        .artifacts[1]
        .payload
    )
    strong = (
        run_agent(
            {
                "stage": "high_school",
                "knowledgeMastery": [
                    {"knowledgeCode": "sorting.bubble_sort", "masteryPercent": 85}
                ],
            }
        )
        .artifacts[1]
        .payload
    )

    assert weak["practiceLevel"] == "REINFORCE"
    assert weak["questions"][0]["id"] == "upper-pass"
    assert strong["practiceLevel"] == "EXTEND"
    assert len(strong["questions"]) == 3
    assert strong["maxScore"] == 30


def test_unimplemented_topic_does_not_mislabel_bubble_sort_artifacts() -> None:
    # 问题明确是冒泡排序时，即使 context 里残留其他主题名，也不应串题。
    result = run_agent({"topic": "量子纠缠", "stage": "middle_school"})

    assert result.metadata["topic"] == "冒泡排序"
    assert result.artifacts[0].payload["title"] == "冒泡排序逐步演示"
    assert result.artifacts[1].payload["knowledgeCode"] == "sorting.bubble_sort"


def test_high_school_uses_formal_strategy_and_larger_example() -> None:
    result = run_agent({"stage": "高中", "grade": "高一", "topic": "冒泡排序"})

    assert result.metadata["stageCode"] == "high_school"
    assert result.metadata["strategy"] == "formal-and-code-ready"
    assert "O(n²)" in result.output_text
    assert "稳定排序" in result.output_text
    assert len(result.artifacts[0].payload["initialValues"]) == 6
    assert "编程实验" in result.output_text


def test_lower_primary_and_high_school_differ_on_same_topic() -> None:
    """阶段 B 验收：同一主题在不同学段的语言、示例规模与练习应明显不同。"""
    primary = run_agent({"stage": "小学低年级", "grade": "小学二年级", "topic": "冒泡排序"})
    senior = run_agent({"stage": "高中", "grade": "高一", "topic": "冒泡排序"})

    primary_values = primary.artifacts[0].payload["initialValues"]
    senior_values = senior.artifacts[0].payload["initialValues"]
    assert len(primary_values) < len(senior_values)
    assert primary.metadata["stageCode"] == "lower_primary"
    assert senior.metadata["stageCode"] == "high_school"
    assert primary.metadata["strategy"] != senior.metadata["strategy"]
    assert "O(n²)" not in primary.output_text
    assert "O(n²)" in senior.output_text
    assert primary.artifacts[1].payload["questions"][0]["id"] != senior.artifacts[1].payload["questions"][0]["id"]


def test_missing_stage_uses_documented_middle_school_default() -> None:
    result = run_agent({"knownWeakPoints": "错误类型不会被当成列表"})

    assert result.run_id == "run-teaching-1"
    assert result.agent_code == "teaching-assistant"
    assert result.metadata["stage"] == "初中"
    assert result.metadata["grade"] == "初中八年级"
    assert result.metadata["weakPoints"] == []


def test_topic_filters_stale_weak_points_and_mismatched_graph_nav() -> None:
    result = run_topic(
        "什么是数据？举个生活例子",
        {
            "stage": "middle_school",
            "knownWeakPoints": [
                "把 4、2、3 从小到大排列，正确结果是什么？",
                "选择排序",
                "数据需要能被记录下来",
            ],
            "knowledgeGraph": {
                "enabled": True,
                "ready": True,
                "focusCode": "machine_learning.features_labels",
                "focusTitle": "特征与标签",
                "explains": [{"title": "讲义 · 特征与标签", "documentId": "x"}],
                "prerequisiteGaps": [{"code": "computing.loop_basics", "title": "循环基础"}],
                "nextTopics": [{"reason": "建议先补齐先修：machine_learning.features_labels"}],
                "neighbors": [],
            },
        },
    )

    assert result.metadata["topicCode"] == "data_literacy.what_is_data"
    assert "本轮重点关注" not in result.output_text or "从小到大排列" not in result.output_text
    assert "讲义 · 特征与标签" not in result.output_text
    assert "循环基础" not in result.output_text
    assert "数据需要能被记录下来" in result.output_text or "本轮重点关注" not in result.output_text


def test_graph_nav_never_exposes_knowledge_codes() -> None:
    from k12_agent_runtime.infrastructure.agents.teaching_assistant.nodes import (
        _format_knowledge_graph_section,
        _graph_knowledge_codes,
        _humanize_knowledge_labels,
    )

    assert "隐私" in _humanize_knowledge_labels("建议先补齐先修：data_literacy.privacy_basics")
    assert "data_literacy" not in _humanize_knowledge_labels(
        "建议先补齐先修：data_literacy.privacy_basics"
    )

    class _RunInput:
        input_text = "怎么写提示词、什么是幻觉？"

    state = {
        "topic": "大模型幻觉",
        "topic_code": "generative_ai.hallucination",
        "run_input": _RunInput(),
        "knowledge_graph": {
            "enabled": True,
            "ready": True,
            "focusCode": "generative_ai.hallucination",
            "prerequisiteGaps": [
                {"code": "generative_ai.prompt_basics", "title": "提示词基础"},
            ],
            "nextTopics": [
                {
                    "code": "generative_ai.responsible_use",
                    "title": "负责任使用生成式 AI",
                    "reason": "建议先补齐先修：data_literacy.privacy_basics",
                    "missingPrerequisites": ["data_literacy.privacy_basics"],
                }
            ],
            "explains": [
                {
                    "documentId": "teaching-resource-12",
                    "title": "讲义 · 提示词与负责任使用",
                }
            ],
        },
    }
    section = _format_knowledge_graph_section(state)  # type: ignore[arg-type]
    assert "data_literacy" not in section
    assert "generative_ai" not in section
    assert "提示词基础" in section
    assert "讲义 · 提示词与负责任使用" in section
    assert "下一站预告" in section or "负责任使用" in section

    codes = _graph_knowledge_codes(state)  # type: ignore[arg-type]
    assert "generative_ai.hallucination" in codes
    assert "generative_ai.prompt_basics" in codes


def test_model_enhances_text_but_not_deterministic_animation() -> None:
    agent = TeachingAssistantAgent(FakeChatModel())
    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-model-1",
                agent_code="teaching-assistant",
                input_text="冒泡排序是什么？",
                context={"stage": "小学高年级"},
            )
        )
    )

    assert "模型生成的适龄解释" in result.output_text
    assert result.metadata["modelUsed"] is True
    assert result.metadata["model"] == "qwen-test"
    assert result.metadata["modelUsage"] == {
        "prompt_tokens": 20,
        "completion_tokens": 30,
    }
    assert result.artifacts[0].payload["steps"][-1]["values"] == [1, 2, 4, 5]
    assert result.metadata["generatedInteractions"] == [
        "ANIMATION",
        "GAME",
        "UNDERSTANDING_CHECK",
    ]


def test_invalid_model_content_falls_back_to_deterministic_text() -> None:
    agent = TeachingAssistantAgent(InvalidChatModel())
    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-model-fallback",
                agent_code="teaching-assistant",
                input_text="冒泡排序是什么？",
                context={"stage": "初中"},
            )
        )
    )

    assert "冒泡排序通过多轮遍历完成排序" in result.output_text
    assert result.metadata["modelUsed"] is False
    assert result.metadata["modelFallbackReason"] == "invalid_content"


def test_server_personalization_is_sanitized_before_model_use() -> None:
    chat_model = FakeChatModel()
    agent = TeachingAssistantAgent(chat_model)
    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-personalized-1",
                agent_code="teaching-assistant",
                input_text="冒泡排序是什么？",
                context={
                    "stage": "初中",
                    "interests": ["机器人", "编程"],
                    "recentLearningHistory": [
                        {
                            "courseId": 10,
                            "courseTitle": "排序算法入门",
                            "subject": "人工智能",
                            "gradeLevel": "八年级",
                            "progressPercent": 65,
                            "userId": 42,
                        }
                    ],
                    "recentPerformance": [
                        {
                            "homeworkId": 101,
                            "courseId": 10,
                            "status": "GRADED",
                            "score": 55,
                            "feedback": "循环边界需要巩固",
                            "answerContent": "不应进入模型的学生答案",
                            "gradedBy": 99,
                        }
                    ],
                    "personalization": {
                        "schemaVersion": "1.0",
                        "trustedUserId": 42,
                        "profileStatus": "LOADED",
                        "learningHistoryStatus": "LOADED",
                        "performanceStatus": "LOADED",
                    },
                },
            )
        )
    )

    assert chat_model.last_request is not None
    prompt = chat_model.last_request.messages[1].content
    assert "机器人" in prompt
    assert "排序算法入门" in prompt
    assert "循环边界需要巩固" in prompt
    assert "不应进入模型的学生答案" not in prompt
    assert "gradedBy" not in prompt
    assert "userId" not in prompt
    assert result.metadata["personalization"] == {
        "schemaVersion": "1.0",
        "enabled": True,
        "profileStatus": "LOADED",
        "learningHistoryStatus": "LOADED",
        "performanceStatus": "LOADED",
        "practiceStatus": "NOT_PROVIDED",
        "masteryStatus": "NOT_PROVIDED",
        "knowledgeGraphStatus": "NOT_PROVIDED",
        "bubbleSortMasteryPercent": None,
        "interestCount": 2,
        "recentLearningHistoryCount": 1,
        "recentPerformanceCount": 1,
        "recentPracticeCount": 0,
    }


def test_conversation_history_is_sanitized_and_used_for_continuity() -> None:
    chat_model = FakeChatModel()
    agent = TeachingAssistantAgent(chat_model)

    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-conversation-2",
                agent_code="teaching-assistant",
                input_text="那为什么下一轮可以少比较一次？",
                context={
                    "stage": "初中",
                    "conversation": {
                        "schemaVersion": "1.0",
                        "status": "LOADED",
                        "previousTurnCount": 1,
                        "userId": 42,
                    },
                    "conversationHistory": [
                        {
                            "user": "第一轮结束后发生了什么？",
                            "assistant": "最大值已经移动到未排序区间末尾。",
                            "inputContext": {"private": "不得进入提示词"},
                        }
                    ],
                },
            )
        )
    )

    assert chat_model.last_request is not None
    prompt = chat_model.last_request.messages[1].content
    assert "第一轮结束后发生了什么" in prompt
    assert "最大值已经移动到未排序区间末尾" in prompt
    assert "不得进入提示词" not in prompt
    assert "userId" not in prompt
    assert result.metadata["conversation"] == {
        "schemaVersion": "1.0",
        "status": "LOADED",
        "historyUsed": True,
        "previousTurnCount": 1,
    }


def test_rag_context_is_filtered_and_injected_into_chat_model() -> None:
    chat_model = FakeChatModel()
    knowledge_search = FakeKnowledgeSearch(
        (
            RankedDocument(
                document_id="demo-middle-bubble-sort-001",
                text="冒泡排序每轮会把未排序区间中的最大值移动到末尾。",
                rerank_score=0.96,
                retrieval_score=0.82,
                metadata={
                    "chunkId": "demo-middle-bubble-sort-001:0",
                    "title": "冒泡排序的过程与优化",
                    "sourceUri": "demo://middle-school/bubble-sort",
                    "chapter": "排序算法",
                },
            ),
        )
    )
    agent = TeachingAssistantAgent(
        chat_model,
        knowledge_search,  # type: ignore[arg-type]
        rag_candidate_count=12,
        rag_top_k=3,
    )

    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-rag-1",
                agent_code="teaching-assistant",
                input_text="为什么每一轮都能确定一个最大值？",
                context={
                    "stage": "初中",
                    "grade": "八年级",
                    "textbook": "K12人工智能通识演示教材",
                    "topic": "冒泡排序",
                },
            )
        )
    )

    command = knowledge_search.commands[0]
    assert command.candidate_count == 12
    assert command.top_k == 3
    assert command.stage_code == "middle_school"
    assert command.grade == "八年级"
    assert command.textbook == "K12人工智能通识演示教材"
    assert "冒泡排序" in command.query
    assert chat_model.last_request is not None
    assert "冒泡排序每轮会把" in chat_model.last_request.messages[1].content
    assert result.metadata["ragRetrieved"] is True
    assert result.metadata["ragUsed"] is True
    assert result.metadata["knowledgeReferences"] == [
        {
            "documentId": "demo-middle-bubble-sort-001",
            "chunkId": "demo-middle-bubble-sort-001:0",
            "title": "冒泡排序的过程与优化",
            "sourceUri": "demo://middle-school/bubble-sort",
            "chapter": "排序算法",
        }
    ]
    assert result.metadata["knowledgeGrounding"] == {
        "schemaVersion": "1.0",
        "status": "USED",
        "notice": "本次回答参考了课程知识库，请结合教材和教师要求核对。",
        "references": result.metadata["knowledgeReferences"],
    }


def test_rag_failure_does_not_break_deterministic_teaching() -> None:
    agent = TeachingAssistantAgent(
        search_knowledge=BrokenKnowledgeSearch(),  # type: ignore[arg-type]
    )

    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-rag-fallback",
                agent_code="teaching-assistant",
                input_text="冒泡排序是什么？",
                context={"stage": "初中"},
            )
        )
    )

    assert result.status is AgentRunStatus.SUCCEEDED
    assert "冒泡排序通过多轮遍历完成排序" in result.output_text
    assert result.metadata["ragRetrieved"] is False
    assert result.metadata["ragUsed"] is False
    assert result.metadata["ragFallbackReason"] == "unavailable"
    assert result.metadata["knowledgeGrounding"] == {
        "schemaVersion": "1.0",
        "status": "UNAVAILABLE",
        "notice": "知识库服务暂时不可用，本次回答已自动降级。",
        "references": [],
    }


def test_retrieved_documents_are_not_reported_as_used_when_model_is_disabled() -> None:
    knowledge_search = FakeKnowledgeSearch(
        (
            RankedDocument(
                document_id="demo-middle-bubble-sort-001",
                text="冒泡排序资料",
                rerank_score=0.91,
                metadata={"title": "冒泡排序的过程与优化"},
            ),
        )
    )
    agent = TeachingAssistantAgent(
        search_knowledge=knowledge_search,  # type: ignore[arg-type]
    )

    result = asyncio.run(
        agent.invoke(
            AgentRunInput(
                run_id="run-rag-not-used",
                agent_code="teaching-assistant",
                input_text="冒泡排序是什么？",
                context={"stage": "初中"},
            )
        )
    )

    assert result.metadata["ragRetrieved"] is True
    assert result.metadata["ragUsed"] is False
    assert result.metadata["knowledgeGrounding"]["status"] == "RETRIEVED_NOT_USED"
    assert result.metadata["knowledgeGrounding"]["references"] == []


def test_course_recommendations_survive_knowledge_graph_sanitize():
    result = run_topic(
        "什么是提示词？",
        {
            "stage": "初中",
            "knowledgeGraph": {
                "enabled": True,
                "ready": True,
                "focusCode": "generative_ai.prompt_basics",
                "focusTitle": "提示词基础",
                "neighbors": [],
                "prerequisiteGaps": [],
                "nextTopics": [],
                "explains": [
                    {
                        "documentId": "teaching-resource-12",
                        "title": "讲义 · 提示词与负责任使用",
                    }
                ],
                "coveredChapters": [
                    {
                        "courseId": 7,
                        "chapterId": 42,
                        "courseTitle": "AI 素养入门",
                        "chapterTitle": "第四章 会说话的大模型",
                        "refKey": "course-7-chapter-42",
                    }
                ],
            },
            "personalization": {"knowledgeGraphStatus": "LOADED"},
        },
    )

    assert result.metadata["courseRecommendations"] == [
        {
            "courseId": 7,
            "chapterId": 42,
            "courseTitle": "AI 素养入门",
            "chapterTitle": "第四章 会说话的大模型",
        }
    ]
    assert result.metadata["knowledgeGraph"]["coveredChapters"][0]["courseId"] == 7


def test_course_recommend_intent_skips_explanation_template():
    result = run_topic(
        "推荐提示词相关课程",
        {
            "stage": "初中",
            "knowledgeGraph": {
                "enabled": True,
                "ready": True,
                "focusCode": "generative_ai.prompt_basics",
                "focusTitle": "提示词基础",
                "coveredChapters": [
                    {
                        "courseId": 7,
                        "chapterId": 42,
                        "courseTitle": "AI 素养入门",
                        "chapterTitle": "第四章 会说话的大模型",
                    }
                ],
            },
            "personalization": {"knowledgeGraphStatus": "LOADED"},
        },
    )
    assert result.metadata["intentMode"] == "COURSE_RECOMMEND"
    assert "概念解释" not in (result.output_text or "")
    assert "课程与资料推荐" in (result.output_text or "")
    assert result.metadata["courseRecommendations"][0]["courseId"] == 7
    assert result.metadata.get("modelUsed") is False


def test_course_recommend_intent_allows_topic_between_action_and_course():
    result = run_topic(
        "推荐学习监督相关学习课程",
        {
            "stage": "初中",
            "knowledgeGraph": {
                "enabled": True,
                "ready": True,
                "focusCode": "machine_learning.supervised_learning",
                "focusTitle": "监督学习",
                "coveredChapters": [
                    {
                        "courseId": 9,
                        "chapterId": 18,
                        "courseTitle": "机器学习入门",
                        "chapterTitle": "带着答案学习",
                    }
                ],
            },
            "personalization": {"knowledgeGraphStatus": "LOADED"},
        },
    )

    assert result.metadata["intentMode"] == "COURSE_RECOMMEND"
    assert result.metadata["topicCode"] == "machine_learning.supervised_learning"
    assert result.metadata["courseRecommendations"] == [
        {
            "courseId": 9,
            "chapterId": 18,
            "courseTitle": "机器学习入门",
            "chapterTitle": "带着答案学习",
        }
    ]
    assert "课程与资料推荐" in (result.output_text or "")
    assert "概念解释" not in (result.output_text or "")


def test_off_topic_intent_increments_strike_without_rag():
    result = run_topic(
        "今天天气怎么样",
        {"stage": "初中", "offTopicStrikeCount": 1},
    )
    assert result.metadata["intentMode"] == "OFF_TOPIC"
    assert result.metadata["offTopicStrikeCount"] == 2
    assert "2/5" in (result.output_text or "")
    assert "临时封禁" in (result.output_text or "")
    assert "什么是提示词" in (result.output_text or "")
    assert result.metadata.get("ragRetrieved") is False
    assert "概念解释" not in (result.output_text or "")


def test_off_topic_limit_message():
    result = run_topic(
        "陪我打王者荣耀",
        {"stage": "初中", "offTopicStrikeCount": 4},
    )
    assert result.metadata["intentMode"] == "OFF_TOPIC"
    assert result.metadata["offTopicStrikeCount"] == 5
    assert "5/5" in (result.output_text or "")
    assert "异常行为" in (result.output_text or "")
