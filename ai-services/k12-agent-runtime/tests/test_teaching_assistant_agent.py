import asyncio

from k12_agent_runtime.domain.agents.models import (
    AgentArtifactKind,
    AgentRunInput,
    AgentRunStatus,
)
from k12_agent_runtime.domain.llm import ChatRequest, ChatResponse
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


class FakeChatModel:
    async def complete(self, request: ChatRequest) -> ChatResponse:
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
