import asyncio

from k12_agent_runtime.application.rag import SearchKnowledgeCommand
from k12_agent_runtime.domain.agents.models import (
    AgentArtifactKind,
    AgentRunInput,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatRequest, ChatResponse
from k12_agent_runtime.domain.rag import KnowledgeSearchResult, RankedDocument
from k12_agent_runtime.infrastructure.agents.teaching_assistant import (
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
    weak = run_agent({
        "stage": "high_school",
        "knowledgeMastery": [{"knowledgeCode": "sorting.bubble_sort", "masteryPercent": 40}],
    }).artifacts[1].payload
    strong = run_agent({
        "stage": "high_school",
        "knowledgeMastery": [{"knowledgeCode": "sorting.bubble_sort", "masteryPercent": 85}],
    }).artifacts[1].payload

    assert weak["practiceLevel"] == "REINFORCE"
    assert weak["questions"][0]["id"] == "upper-pass"
    assert strong["practiceLevel"] == "EXTEND"
    assert len(strong["questions"]) == 3
    assert strong["maxScore"] == 30


def test_unimplemented_topic_does_not_mislabel_bubble_sort_artifacts() -> None:
    result = run_agent({"topic": "神经网络", "stage": "middle_school"})

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


def test_missing_stage_uses_documented_middle_school_default() -> None:
    result = run_agent({"knownWeakPoints": "错误类型不会被当成列表"})

    assert result.run_id == "run-teaching-1"
    assert result.agent_code == "teaching-assistant"
    assert result.metadata["stage"] == "初中"
    assert result.metadata["grade"] == "初中八年级"
    assert result.metadata["weakPoints"] == []


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
