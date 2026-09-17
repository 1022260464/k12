package com.k12.platform.learning.dto;

import java.time.Instant;

/** 当前学生一门已报名课程的学习进度摘要。 */
public record CourseLearningSummaryResponse(
        Long courseId,
        String courseTitle,
        String subject,
        String gradeLevel,
        int totalChapters,
        int completedChapters,
        int progressPercent,
        Instant enrolledTime,
        Instant lastLearningTime
) {
}
