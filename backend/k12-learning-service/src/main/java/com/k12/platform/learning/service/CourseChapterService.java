package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.dto.ChapterRequest;
import com.k12.platform.learning.dto.ChapterResponse;
import com.k12.platform.learning.dto.ChapterSummaryResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.model.CourseChapter;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class CourseChapterService {
    private final CourseAccessService access;
    private final CourseChapterMapper chapterMapper;
    private final KnowledgeGraphService knowledgeGraphService;
    private final CourseContentMediaRewriter contentMediaRewriter;

    public CourseChapterService(
            CourseAccessService access,
            CourseChapterMapper chapterMapper,
            KnowledgeGraphService knowledgeGraphService,
            CourseContentMediaRewriter contentMediaRewriter
    ) {
        this.access = access;
        this.chapterMapper = chapterMapper;
        this.knowledgeGraphService = knowledgeGraphService;
        this.contentMediaRewriter = contentMediaRewriter;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public List<ChapterSummaryResponse> list(Long courseId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        return chapterMapper.selectList(Wrappers.lambdaQuery(CourseChapter.class)
                .select(CourseChapter::getId, CourseChapter::getCourseId, CourseChapter::getTitle,
                        CourseChapter::getSortOrder, CourseChapter::getUpdatedTime)
                .eq(CourseChapter::getCourseId, courseId)
                .orderByAsc(CourseChapter::getSortOrder, CourseChapter::getId)).stream()
                .map(chapter -> new ChapterSummaryResponse(chapter.getId(), chapter.getCourseId(), chapter.getTitle(),
                        chapter.getSortOrder(), chapter.getUpdatedTime())).toList();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public ChapterResponse get(Long courseId, Long chapterId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        return response(requireChapter(courseId, chapterId));
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public ChapterResponse create(Long courseId, ChapterRequest request) {
        // 全部课程写入先锁课程行，避免删课、选课、章节修改间的检查后状态变化。
        access.requireOwner(access.requireCourse(courseId, true));
        if (chapterMapper.selectCount(Wrappers.lambdaQuery(CourseChapter.class)
                .eq(CourseChapter::getCourseId, courseId)) >= 500) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "每门课程最多 500 个有效章节");
        }
        CourseChapter chapter = new CourseChapter();
        chapter.setCourseId(courseId);
        chapter.setDeleted(0);
        apply(chapter, request);
        chapterMapper.insert(chapter);
        knowledgeGraphService.syncChapterRef(
                courseId, chapter.getId(), chapter.getTitle(), chapter.getContent());
        return response(chapter);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public ChapterResponse update(Long courseId, Long chapterId, ChapterRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        CourseChapter chapter = requireChapter(courseId, chapterId);
        apply(chapter, request);
        chapterMapper.updateById(chapter);
        knowledgeGraphService.syncChapterRef(
                courseId, chapter.getId(), chapter.getTitle(), chapter.getContent());
        return response(chapter);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public void delete(Long courseId, Long chapterId) {
        access.requireOwner(access.requireCourse(courseId, true));
        requireChapter(courseId, chapterId);
        chapterMapper.deleteById(chapterId);
        knowledgeGraphService.removeChapterCovers(courseId, chapterId);
    }

    private CourseChapter requireChapter(Long courseId, Long chapterId) {
        CourseChapter chapter = chapterMapper.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程章节不存在");
        }
        return chapter;
    }

    private void apply(CourseChapter chapter, ChapterRequest request) {
        chapter.setTitle(request.title().trim());
        String content = request.content() == null ? "" : request.content().trim();
        String stamped = contentMediaRewriter.stampObjectKeys(content);
        String plain = KnowledgeGraphService.collapseWhitespace(KnowledgeGraphService.stripHtml(stamped));
        if (!StringUtils.hasText(plain)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "章节导语不能为空");
        }
        chapter.setContent(stamped);
        chapter.setSortOrder(request.sortOrder());
        chapter.setUpdatedTime(Instant.now());
    }

    private ChapterResponse response(CourseChapter chapter) {
        return new ChapterResponse(chapter.getId(), chapter.getCourseId(), chapter.getTitle(),
                contentMediaRewriter.refreshImageUrls(chapter.getContent()),
                chapter.getSortOrder(), chapter.getUpdatedTime());
    }
}
