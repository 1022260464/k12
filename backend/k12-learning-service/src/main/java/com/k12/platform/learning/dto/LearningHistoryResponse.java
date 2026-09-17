package com.k12.platform.learning.dto;

import java.util.List;

/** 当前学生最近课程学习状态，按最后学习时间倒序。 */
public record LearningHistoryResponse(List<CourseLearningSummaryResponse> items) {
}
