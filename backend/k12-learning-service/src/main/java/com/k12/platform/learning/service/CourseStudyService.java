package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.ChapterProgressResponse;
import com.k12.platform.learning.dto.CourseProgressResponse;
import com.k12.platform.learning.dto.EnrollmentResponse;
import com.k12.platform.learning.mapper.ChapterProgressMapper;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseEnrollmentMapper;
import com.k12.platform.learning.model.ChapterProgress;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.CourseEnrollment;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 学生自己的选课和学习状态；请求参数中没有 userId，避免替其他学生操作。 */
@Service
@PreAuthorize("hasAuthority('ROLE_ADMIN') or (hasAuthority('ROLE_STUDENT') and hasAuthority('course:read'))")
public class CourseStudyService {
    private final CourseAccessService access;
    private final CourseEnrollmentMapper enrollmentMapper;
    private final CourseChapterMapper chapterMapper;
    private final ChapterProgressMapper progressMapper;
    private final LearningEventService eventService;

    public CourseStudyService(CourseAccessService access, CourseEnrollmentMapper enrollmentMapper,
                              CourseChapterMapper chapterMapper, ChapterProgressMapper progressMapper,
                              LearningEventService eventService) {
        this.access = access;
        this.enrollmentMapper = enrollmentMapper;
        this.chapterMapper = chapterMapper;
        this.progressMapper = progressMapper;
        this.eventService = eventService;
    }

    @Transactional
    public EnrollmentResponse enroll(Long courseId) {
        // 先锁父课程，再检查报名记录；配合数据库唯一键防止重复请求并发插入。
        if (!Integer.valueOf(1).equals(access.requireCourse(courseId, true).getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "课程尚未发布");
        }
        CourseEnrollment enrollment = access.enrollment(courseId);
        if (enrollment == null) {
            enrollment = new CourseEnrollment();
            enrollment.setCourseId(courseId);
            enrollment.setUserId(K12SecurityContext.requireUserId());
            enrollment.setStatus("ACTIVE");
            enrollment.setEnrolledTime(Instant.now());
            enrollment.setUpdatedTime(enrollment.getEnrolledTime());
            enrollmentMapper.insert(enrollment);
        } else if (!"ACTIVE".equals(enrollment.getStatus())) {
            // 重新报名复用原记录，保留首次报名时间和已经积累的章节进度。
            enrollment.setStatus("ACTIVE");
            enrollment.setUpdatedTime(Instant.now());
            enrollmentMapper.updateById(enrollment);
        }
        return enrollmentResponse(enrollment);
    }

    public EnrollmentResponse enrollment(Long courseId) {
        access.requireCourse(courseId, false);
        CourseEnrollment enrollment = access.enrollment(courseId);
        // 未选课是常态查询结果，返回 null 避免学生端打开详情时刷 404。
        if (enrollment == null || !"ACTIVE".equals(enrollment.getStatus())) {
            return null;
        }
        return enrollmentResponse(enrollment);
    }

    @Transactional
    public void withdraw(Long courseId) {
        access.requireCourse(courseId, true);
        CourseEnrollment enrollment = access.enrollment(courseId);
        if (enrollment != null && "ACTIVE".equals(enrollment.getStatus())) {
            enrollment.setStatus("WITHDRAWN");
            enrollment.setUpdatedTime(Instant.now());
            enrollmentMapper.updateById(enrollment);
        }
    }

    @Transactional
    public ChapterProgressResponse updateProgress(Long courseId, Long chapterId, int percent) {
        if (percent < 0 || percent > 100) {
            throw new IllegalArgumentException("进度必须在 0 到 100 之间");
        }
        access.requireCourse(courseId, true);
        CourseEnrollment enrollment = access.requireEnrollment(courseId);
        CourseChapter chapter = chapterMapper.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程章节不存在");
        }
        ChapterProgress progress = progressMapper.selectOne(Wrappers.lambdaQuery(ChapterProgress.class)
                .eq(ChapterProgress::getEnrollmentId, enrollment.getId()).eq(ChapterProgress::getChapterId, chapterId));
        boolean advanced = false;
        Instant occurredTime = Instant.now();
        if (progress == null) {
            progress = new ChapterProgress();
            progress.setEnrollmentId(enrollment.getId());
            progress.setChapterId(chapterId);
            progress.setProgressPercent(percent);
            progress.setUpdatedTime(occurredTime);
            progressMapper.insert(progress);
            advanced = true;
        } else if (percent > progress.getProgressPercent()) {
            // 网络重试或多个页面可能乱序上报，只推进、不回退单个章节的进度。
            progress.setProgressPercent(percent);
            progress.setUpdatedTime(occurredTime);
            progressMapper.updateById(progress);
            advanced = true;
        }
        if (advanced) {
            eventService.record(enrollment.getUserId(), "COURSE_PROGRESS", "CHAPTER", String.valueOf(chapterId),
                    courseId, chapterId, null, chapter.getTitle(),
                    percent == 100 ? "完成课程章节" : "课程进度更新至 " + percent + "%",
                    "{\"progressPercent\":" + percent + "}",
                    "course-progress:" + enrollment.getId() + ":" + chapterId + ":" + percent,
                    occurredTime);
        }
        return new ChapterProgressResponse(chapterId, chapter.getTitle(), progress.getProgressPercent(), progress.getUpdatedTime());
    }

    @Transactional(readOnly = true)
    public CourseProgressResponse progress(Long courseId) {
        access.requireCourse(courseId, false);
        CourseEnrollment enrollment = access.requireEnrollment(courseId);
        List<CourseChapter> chapters = chapterMapper.selectList(Wrappers.lambdaQuery(CourseChapter.class)
                .select(CourseChapter::getId, CourseChapter::getTitle)
                .eq(CourseChapter::getCourseId, courseId).orderByAsc(CourseChapter::getSortOrder, CourseChapter::getId));
        Map<Long, ChapterProgress> progress = progressMapper.selectList(Wrappers.lambdaQuery(ChapterProgress.class)
                .eq(ChapterProgress::getEnrollmentId, enrollment.getId())).stream()
                .collect(Collectors.toMap(ChapterProgress::getChapterId, Function.identity()));
        List<ChapterProgressResponse> items = chapters.stream().map(chapter -> {
            ChapterProgress item = progress.get(chapter.getId());
            return new ChapterProgressResponse(chapter.getId(), chapter.getTitle(),
                    item == null ? 0 : item.getProgressPercent(), item == null ? null : item.getUpdatedTime());
        }).toList();
        int completed = (int) items.stream().filter(item -> item.progressPercent() == 100).count();
        // 按当前有效章节重新求均值；新增章节会降低总体百分比，但不清空历史学习记录。
        int percent = items.isEmpty() ? 0 : items.stream().mapToInt(ChapterProgressResponse::progressPercent).sum() / items.size();
        return new CourseProgressResponse(courseId, items.size(), completed, percent, items);
    }

    private EnrollmentResponse enrollmentResponse(CourseEnrollment enrollment) {
        return new EnrollmentResponse(enrollment.getCourseId(), enrollment.getUserId(),
                enrollment.getStatus(), enrollment.getEnrolledTime());
    }
}
