package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.SectionRequest;
import com.k12.platform.learning.dto.SectionResponse;
import com.k12.platform.learning.dto.SectionSummaryResponse;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseSectionMapper;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.CourseSection;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/** 课程小节隶属于章节；每次读写都校验课程归属和选课状态。 */
@Service
public class CourseSectionService {
    private final CourseAccessService access;
    private final CourseChapterMapper chapterMapper;
    private final CourseSectionMapper sectionMapper;
    private final CourseContentMediaRewriter contentMediaRewriter;

    public CourseSectionService(
            CourseAccessService access,
            CourseChapterMapper chapterMapper,
            CourseSectionMapper sectionMapper,
            CourseContentMediaRewriter contentMediaRewriter
    ) {
        this.access = access;
        this.chapterMapper = chapterMapper;
        this.sectionMapper = sectionMapper;
        this.contentMediaRewriter = contentMediaRewriter;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public List<SectionSummaryResponse> list(Long courseId, Long chapterId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        requireChapter(courseId, chapterId);
        return sectionMapper.selectList(Wrappers.lambdaQuery(CourseSection.class)
                .select(CourseSection::getId, CourseSection::getChapterId, CourseSection::getTitle,
                        CourseSection::getSortOrder, CourseSection::getUpdatedTime)
                .eq(CourseSection::getChapterId, chapterId)
                .orderByAsc(CourseSection::getSortOrder, CourseSection::getId)).stream()
                .map(section -> new SectionSummaryResponse(section.getId(), section.getChapterId(),
                        section.getTitle(), section.getSortOrder(), section.getUpdatedTime()))
                .toList();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public SectionResponse get(Long courseId, Long chapterId, Long sectionId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        requireChapter(courseId, chapterId);
        return response(requireSection(chapterId, sectionId));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public SectionResponse create(Long courseId, Long chapterId, SectionRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireChapter(courseId, chapterId);
        if (sectionMapper.selectCount(Wrappers.lambdaQuery(CourseSection.class)
                .eq(CourseSection::getChapterId, chapterId)) >= 100) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "每章最多 100 个有效小节");
        }
        CourseSection section = new CourseSection();
        section.setChapterId(chapterId);
        section.setDeleted(0);
        apply(section, request);
        sectionMapper.insert(section);
        return response(section);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public SectionResponse update(Long courseId, Long chapterId, Long sectionId, SectionRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireChapter(courseId, chapterId);
        CourseSection section = requireSection(chapterId, sectionId);
        apply(section, request);
        sectionMapper.updateById(section);
        return response(section);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public void delete(Long courseId, Long chapterId, Long sectionId) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireChapter(courseId, chapterId);
        sectionMapper.deleteById(requireSection(chapterId, sectionId).getId());
    }

    private void requireChapter(Long courseId, Long chapterId) {
        CourseChapter chapter = chapterMapper.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程章节不存在");
        }
    }

    private CourseSection requireSection(Long chapterId, Long sectionId) {
        CourseSection section = sectionMapper.selectById(sectionId);
        if (section == null || !chapterId.equals(section.getChapterId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程小节不存在");
        }
        return section;
    }

    private void apply(CourseSection section, SectionRequest request) {
        section.setTitle(request.title().trim());
        String content = request.content() == null ? "" : request.content().trim();
        section.setContent(contentMediaRewriter.stampObjectKeys(content));
        section.setSortOrder(request.sortOrder());
        section.setUpdatedTime(Instant.now());
    }

    private SectionResponse response(CourseSection section) {
        return new SectionResponse(section.getId(), section.getChapterId(), section.getTitle(),
                contentMediaRewriter.refreshImageUrls(section.getContent()),
                section.getSortOrder(), section.getUpdatedTime());
    }
}
