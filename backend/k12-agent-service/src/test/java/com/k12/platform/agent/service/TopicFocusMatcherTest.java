package com.k12.platform.agent.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TopicFocusMatcherTest {

    @Test
    @DisplayName("从提问文本匹配正式知识点编码")
    void matchesLiteracyTopics() {
        assertThat(TopicFocusMatcher.match("什么是数据？举个生活例子"))
                .isEqualTo("data_literacy.what_is_data");
        assertThat(TopicFocusMatcher.match("特征和标签有什么区别"))
                .isEqualTo("machine_learning.features_labels");
        assertThat(TopicFocusMatcher.match("怎么写提示词、什么是幻觉"))
                .isEqualTo("generative_ai.hallucination");
        assertThat(TopicFocusMatcher.match("推荐学习监督相关学习课程"))
                .isEqualTo("machine_learning.supervised_learning");
    }

    @Test
    @DisplayName("无法识别时返回 null，避免误用掌握度最弱点")
    void returnsNullWhenUnknown() {
        assertThat(TopicFocusMatcher.match("今天天气怎么样")).isNull();
        assertThat(TopicFocusMatcher.match(null)).isNull();
        assertThat(TopicFocusMatcher.match("  ")).isNull();
    }
}
