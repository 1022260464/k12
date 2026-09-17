package com.k12.platform.agent.client.dto;

import java.time.Instant;

/** Learning Service 返回的一门课程学习进度摘要。 */
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
