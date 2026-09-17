package com.k12.platform.learning.model;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Mapper 聚合查询结果，不对应单独数据库表。 */
@Getter
@Setter
public class CourseLearningSummary {
    private Long courseId;
    private String courseTitle;
    private String subject;
    private String gradeLevel;
    private Integer totalChapters;
    private Integer completedChapters;
    private Integer progressPercent;
    private Instant enrolledTime;
    private Instant lastLearningTime;
}
