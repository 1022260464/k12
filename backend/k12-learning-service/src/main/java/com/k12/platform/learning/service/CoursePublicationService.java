package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.CourseSectionMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.CourseSection;
import org.springframework.beans.factory.ObjectProvider;
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
    private final KnowledgeGraphService knowledgeGraphService;
    private final PublishedCourseListCache publishedCourseListCache;
    private final KnowledgeGraphOverviewCache overviewCache;

    public CoursePublicationService(CourseAccessService access, CourseMapper courseMapper,
                                    CourseChapterMapper chapterMapper, CourseSectionMapper sectionMapper,
                                    KnowledgeGraphService knowledgeGraphService,
                                    ObjectProvider<PublishedCourseListCache> publishedCourseListCache,
                                    ObjectProvider<KnowledgeGraphOverviewCache> overviewCache) {
        this.access = access;
        this.courseMapper = courseMapper;
        this.chapterMapper = chapterMapper;
        this.sectionMapper = sectionMapper;
        this.knowledgeGraphService = knowledgeGraphService;
        this.publishedCourseListCache = publishedCourseListCache.getIfAvailable();
        this.overviewCache = overviewCache.getIfAvailable();
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
        // 发布即进入教学闭环：校验各章已绑定官方目录知识点（图谱侧 COVERS）。
        knowledgeGraphService.assertChaptersCoveredForPublish(courseId, chapters);
        course.setStatus(1);
        course.setUpdatedTime(Instant.now());
        courseMapper.updateById(course);
        knowledgeGraphService.markCourseChapterRefsPublished(courseId);
        if (publishedCourseListCache != null) {
            try {
                publishedCourseListCache.invalidate();
            } catch (RuntimeException ignored) {
                // 下次推荐读取时回源即可
            }
        }
        if (overviewCache != null) {
            try {
                overviewCache.invalidate();
            } catch (RuntimeException ignored) {
                // overview 下次读取时回源即可
            }
        }
    }
}
