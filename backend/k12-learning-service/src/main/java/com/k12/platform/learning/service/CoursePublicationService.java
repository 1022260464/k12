package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.CourseSectionMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.CourseSection;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class CoursePublicationService {
    private final CourseAccessService access;
    private final CourseMapper courseMapper;
    private final CourseChapterMapper chapterMapper;
    private final CourseSectionMapper sectionMapper;

    public CoursePublicationService(CourseAccessService access, CourseMapper courseMapper,
                                    CourseChapterMapper chapterMapper, CourseSectionMapper sectionMapper) {
        this.access = access;
        this.courseMapper = courseMapper;
        this.chapterMapper = chapterMapper;
        this.sectionMapper = sectionMapper;
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public void publish(Long courseId) {
        Course course = access.requireCourse(courseId, true);
        access.requireOwner(course);
        if (!Integer.valueOf(0).equals(course.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "只有草稿课程可以发布");
        }
        List<CourseChapter> chapters = chapterMapper.selectList(Wrappers.lambdaQuery(CourseChapter.class)
                .eq(CourseChapter::getCourseId, courseId)
                .orderByAsc(CourseChapter::getSortOrder, CourseChapter::getId));
        if (chapters.isEmpty()) {
            throw new IllegalArgumentException("发布前请至少添加一章教学内容");
        }
        for (CourseChapter chapter : chapters) {
            if (StringUtils.hasText(chapter.getContent())) {
                continue;
            }
            Long sectionCount = sectionMapper.selectCount(Wrappers.lambdaQuery(CourseSection.class)
                    .eq(CourseSection::getChapterId, chapter.getId()));
            if (sectionCount == 0) {
                throw new IllegalArgumentException("章节“" + chapter.getTitle() + "”没有导语或小节正文，无法发布");
            }
        }
        course.setStatus(1);
        course.setUpdatedTime(Instant.now());
        courseMapper.updateById(course);
    }
}
