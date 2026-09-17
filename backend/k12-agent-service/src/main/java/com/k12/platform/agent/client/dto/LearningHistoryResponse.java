package com.k12.platform.agent.client.dto;

import java.util.List;

/** Learning Service 当前学生学习历史的只读契约。 */
public record LearningHistoryResponse(List<CourseLearningSummaryResponse> items) {
}
