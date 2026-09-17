package com.k12.platform.agent.client.dto;

import java.util.List;

/** Assessment 当前学生学习结果的分页契约。 */
public record LearningResultPageResponse(
        List<LearningResultResponse> items,
        int page,
        int size,
        long total
) {
}
