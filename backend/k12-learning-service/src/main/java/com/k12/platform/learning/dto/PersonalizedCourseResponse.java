package com.k12.platform.learning.dto;

public record PersonalizedCourseResponse(
        CourseResponse course,
        Long chapterId,
        String chapterTitle,
        String knowledgeCode,
        Integer masteryPercent,
        String reason
) { }
