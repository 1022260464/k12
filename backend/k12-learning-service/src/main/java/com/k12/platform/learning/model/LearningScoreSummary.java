package com.k12.platform.learning.model;

import lombok.Getter;
import lombok.Setter;

/** Mapper聚合结果，不对应独立数据库表。 */
@Getter
@Setter
public class LearningScoreSummary {
    private Long userId;
    private Long learningPoints;
}
