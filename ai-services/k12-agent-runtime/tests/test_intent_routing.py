from __future__ import annotations

from k12_agent_runtime.infrastructure.agents.teaching_assistant.intent import (
    OFF_TOPIC_LIMIT,
    classify_intent,
    next_off_topic_strike,
    off_topic_message,
)


def test_classify_explain_for_concept_question():
    assert classify_intent("什么是提示词？", None) == "EXPLAIN"


def test_classify_course_recommend_without_explanation_template():
    assert classify_intent("推荐提示词相关课程", None) == "COURSE_RECOMMEND"
    assert classify_intent("有哪些课可以学幻觉", None) == "COURSE_RECOMMEND"


def test_classify_prefer_explain_when_mixed():
    assert classify_intent("什么是提示词？顺便推荐相关课程", None) == "EXPLAIN"


def test_classify_off_topic_by_keyword():
    assert classify_intent("今天天气怎么样", None) == "OFF_TOPIC"
    assert classify_intent("陪我打王者荣耀", "generative_ai.prompt_basics") == "OFF_TOPIC"


def test_classify_chitchat_off_topic():
    assert classify_intent("哈哈无聊", None) == "OFF_TOPIC"


def test_off_topic_strike_message():
    first = off_topic_message(1)
    assert "1/5" in first
    assert "**（无关提问 1/5）**" in first
    assert "临时封禁" in first
    assert "什么是提示词" in first
    assert "推荐提示词相关课程" in first
    second = off_topic_message(2)
    assert "2/5" in second
    assert "再发送 3 次" in second
    assert f"**无关提问已达 {OFF_TOPIC_LIMIT}/{OFF_TOPIC_LIMIT}。**" in off_topic_message(OFF_TOPIC_LIMIT)
    assert "异常行为" in off_topic_message(OFF_TOPIC_LIMIT)
    assert next_off_topic_strike(4) == 5


def test_expanded_off_topic_keywords():
    assert classify_intent("今晚看啥综艺", None) == "OFF_TOPIC"
    assert classify_intent("英雄联盟上分", None) == "OFF_TOPIC"
    assert classify_intent("推荐个女朋友", None) == "OFF_TOPIC"
    assert classify_intent("什么是提示词", None) == "EXPLAIN"


def test_soft_output_guard_is_lenient_for_primary():
    from k12_agent_runtime.infrastructure.agents.teaching_assistant.intent import (
        looks_like_off_topic_model_output,
        soft_redirect_message,
    )

    learning = "### 概念解释\n\n提示词是给大模型的说明文字，能减少幻觉。"
    assert looks_like_off_topic_model_output(learning, stage="lower_primary") is False

    mild = "今天天气不错，我们继续学习算法。"
    assert looks_like_off_topic_model_output(mild, stage="lower_primary") is False

    strong = (
        "今天天气很好。气温适宜。"
        "你可以去打王者荣耀上分，晚上刷抖音看直播，再追星看八卦新闻。"
    )
    assert looks_like_off_topic_model_output(strong, stage="middle_school") is True
    assert looks_like_off_topic_model_output(strong, stage="lower_primary") is True
    assert "什么是提示词" in soft_redirect_message(stage="middle_school")
