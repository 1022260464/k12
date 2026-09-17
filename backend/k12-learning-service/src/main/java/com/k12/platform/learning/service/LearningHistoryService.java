package com.k12.platform.learning.service;

import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.CourseLearningSummaryResponse;
import com.k12.platform.learning.dto.LearningHistoryResponse;
import com.k12.platform.learning.mapper.LearningHistoryMapper;
import com.k12.platform.learning.model.CourseLearningSummary;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 查询当前登录学生的跨课程学习进度摘要。 */
@Service
public class LearningHistoryService {

    private static final int MAX_LIMIT = 20;

    private final LearningHistoryMapper historyMapper;

    public LearningHistoryService(LearningHistoryMapper historyMapper) {
        this.historyMapper = historyMapper;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or (hasAuthority('ROLE_STUDENT') and hasAuthority('course:read'))")
    public LearningHistoryResponse currentUserHistory(int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new IllegalArgumentException("limit 必须在 1 到 " + MAX_LIMIT + " 之间");
        }
        Long userId = K12SecurityContext.requireUserId();
        return new LearningHistoryResponse(
                historyMapper.selectRecentByUserId(userId, limit).stream()
                        .map(this::toResponse)
                        .toList()
        );
    }

    private CourseLearningSummaryResponse toResponse(CourseLearningSummary source) {
        return new CourseLearningSummaryResponse(
                source.getCourseId(),
                source.getCourseTitle(),
                source.getSubject(),
                source.getGradeLevel(),
                valueOrZero(source.getTotalChapters()),
                valueOrZero(source.getCompletedChapters()),
                valueOrZero(source.getProgressPercent()),
                source.getEnrolledTime(),
                source.getLastLearningTime()
        );
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }
}
