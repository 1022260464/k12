package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.SectionActivityRequest;
import com.k12.platform.learning.dto.SectionActivityResponse;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseSectionActivityMapper;
import com.k12.platform.learning.mapper.CourseSectionMapper;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.CourseSection;
import com.k12.platform.learning.model.CourseSectionActivity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** 将正式课程小节绑定到受控的站内教学活动，不允许数据库保存任意跳转 URL。 */
@Service
public class CourseSectionActivityService {
    private static final int MAX_ACTIVITIES_PER_SECTION = 20;

    private final CourseAccessService access;
    private final CourseChapterMapper chapterMapper;
    private final CourseSectionMapper sectionMapper;
    private final CourseSectionActivityMapper activityMapper;

    public CourseSectionActivityService(
            CourseAccessService access,
            CourseChapterMapper chapterMapper,
            CourseSectionMapper sectionMapper,
            CourseSectionActivityMapper activityMapper
    ) {
        this.access = access;
        this.chapterMapper = chapterMapper;
        this.sectionMapper = sectionMapper;
        this.activityMapper = activityMapper;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public List<SectionActivityResponse> list(Long courseId, Long chapterId, Long sectionId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        requireSection(courseId, chapterId, sectionId);
        return activityMapper.selectList(Wrappers.lambdaQuery(CourseSectionActivity.class)
                        .eq(CourseSectionActivity::getSectionId, sectionId)
                        .orderByAsc(CourseSectionActivity::getSortOrder, CourseSectionActivity::getId))
                .stream().map(this::response).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public SectionActivityResponse create(Long courseId, Long chapterId, Long sectionId,
                                          SectionActivityRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireSection(courseId, chapterId, sectionId);
        if (activityMapper.selectCount(Wrappers.lambdaQuery(CourseSectionActivity.class)
                .eq(CourseSectionActivity::getSectionId, sectionId)
                .eq(CourseSectionActivity::getActivityType, request.activityType())
                .eq(CourseSectionActivity::getReferenceKey, request.referenceKey())) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该小节已绑定相同活动");
        }
        if (activityMapper.selectCount(Wrappers.lambdaQuery(CourseSectionActivity.class)
                .eq(CourseSectionActivity::getSectionId, sectionId)) >= MAX_ACTIVITIES_PER_SECTION) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "每个小节最多 20 个有效活动");
        }
        CourseSectionActivity activity = new CourseSectionActivity();
        activity.setSectionId(sectionId);
        activity.setDeleted(0);
        apply(activity, request);
        activityMapper.insert(activity);
        return response(activity);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public SectionActivityResponse update(Long courseId, Long chapterId, Long sectionId, Long activityId,
                                          SectionActivityRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireSection(courseId, chapterId, sectionId);
        CourseSectionActivity activity = requireActivity(sectionId, activityId);
        if (activityMapper.selectCount(Wrappers.lambdaQuery(CourseSectionActivity.class)
                .eq(CourseSectionActivity::getSectionId, sectionId)
                .eq(CourseSectionActivity::getActivityType, request.activityType())
                .eq(CourseSectionActivity::getReferenceKey, request.referenceKey())
                .ne(CourseSectionActivity::getId, activityId)) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该小节已绑定相同活动");
        }
        apply(activity, request);
        activityMapper.updateById(activity);
        return response(activity);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public void delete(Long courseId, Long chapterId, Long sectionId, Long activityId) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireSection(courseId, chapterId, sectionId);
        activityMapper.deleteById(requireActivity(sectionId, activityId).getId());
    }

    private void requireSection(Long courseId, Long chapterId, Long sectionId) {
        CourseChapter chapter = chapterMapper.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程章节不存在");
        }
        CourseSection section = sectionMapper.selectById(sectionId);
        if (section == null || !chapterId.equals(section.getChapterId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程小节不存在");
        }
    }

    private CourseSectionActivity requireActivity(Long sectionId, Long activityId) {
        CourseSectionActivity activity = activityMapper.selectById(activityId);
        if (activity == null || !sectionId.equals(activity.getSectionId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程活动不存在");
        }
        return activity;
    }

    private void apply(CourseSectionActivity activity, SectionActivityRequest request) {
        activity.setActivityType(request.activityType());
        activity.setReferenceKey(request.referenceKey());
        activity.setTitle(request.title().trim());
        activity.setDescription(normalize(request.description()));
        activity.setSortOrder(request.sortOrder());
        activity.setRequired(request.required());
        activity.setUpdatedTime(Instant.now());
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private SectionActivityResponse response(CourseSectionActivity activity) {
        return new SectionActivityResponse(activity.getId(), activity.getSectionId(), activity.getActivityType(),
                activity.getReferenceKey(), activity.getTitle(), activity.getDescription(), activity.getSortOrder(),
                activity.getRequired(), activity.getUpdatedTime());
    }
}
