package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.ChapterCoversRequest;
import com.k12.platform.learning.dto.ChapterCoversResponse;
import com.k12.platform.learning.dto.KnowledgeCoverSuggestion;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversRequest;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.model.CourseChapter;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChapterKnowledgeCoverService {
    private final CourseAccessService access;
    private final CourseChapterMapper chapterMapper;
    private final KnowledgeGraphService knowledgeGraphService;
    private final KnowledgeCoverSuggestClient suggestClient;

    public ChapterKnowledgeCoverService(
            CourseAccessService access,
            CourseChapterMapper chapterMapper,
            KnowledgeGraphService knowledgeGraphService,
            KnowledgeCoverSuggestClient suggestClient
    ) {
        this.access = access;
        this.chapterMapper = chapterMapper;
        this.knowledgeGraphService = knowledgeGraphService;
        this.suggestClient = suggestClient;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public ChapterCoversResponse getCovers(Long courseId, Long chapterId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        requireChapter(courseId, chapterId);
        return new ChapterCoversResponse(
                courseId,
                chapterId,
                knowledgeGraphService.listChapterCovers(courseId, chapterId)
        );
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:update')")
    public ChapterCoversResponse replaceCovers(Long courseId, Long chapterId, ChapterCoversRequest request) {
        access.requireOwner(access.requireCourse(courseId, true));
        CourseChapter chapter = requireChapter(courseId, chapterId);
        List<String> codes = request == null || request.knowledgeCodes() == null
                ? List.of()
                : request.knowledgeCodes();
        List<KnowledgePointResponse> covers = knowledgeGraphService.replaceChapterCovers(
                courseId, chapterId, chapter.getTitle(), chapter.getContent(), codes);
        return new ChapterCoversResponse(courseId, chapterId, covers);
    }

    @PreAuthorize("isAuthenticated()")
    public KnowledgeSuggestCoversResponse suggest(KnowledgeSuggestCoversRequest request) {
        int limit = request != null && request.limit() != null ? request.limit() : 5;
        String title = request == null ? null : request.title();
        String content = request == null ? null : request.content();
        String stage = request == null ? null : request.stage();

        List<KnowledgePointResponse> catalog = knowledgeGraphService.listPoints(null, stage, 500);
        if (catalog.isEmpty()) {
            catalog = knowledgeGraphService.listPoints(null, null, 500);
        }
        // 先本地粗排，再把前 60 个交给大模型，避免数百候选撑爆上下文。
        List<KnowledgeCoverSuggestion> lexicalPrefilter = KnowledgeGraphService.scoreAgainstCatalog(
                title, content, catalog, Math.min(60, Math.max(limit * 8, 24)));
        List<KnowledgePointResponse> aiCandidates = catalog;
        if (!lexicalPrefilter.isEmpty()) {
            Map<String, KnowledgePointResponse> byCode = new LinkedHashMap<>();
            for (KnowledgePointResponse point : catalog) {
                if (point != null && StringUtils.hasText(point.code())) {
                    byCode.put(point.code(), point);
                }
            }
            List<KnowledgePointResponse> narrowed = new ArrayList<>();
            for (KnowledgeCoverSuggestion item : lexicalPrefilter) {
                KnowledgePointResponse point = byCode.get(item.code());
                if (point != null) {
                    narrowed.add(point);
                }
            }
            if (!narrowed.isEmpty()) {
                aiCandidates = narrowed;
            }
        }
        List<KnowledgeCoverSuggestion> ai = suggestClient.suggest(title, content, aiCandidates, limit);
        if (!ai.isEmpty()) {
            return new KnowledgeSuggestCoversResponse(ai, "llm");
        }
        List<KnowledgeCoverSuggestion> lexical = knowledgeGraphService.suggestCoversLexical(
                title, content, stage, limit);
        return new KnowledgeSuggestCoversResponse(lexical, "lexical");
    }

    private CourseChapter requireChapter(Long courseId, Long chapterId) {
        CourseChapter chapter = chapterMapper.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课程章节不存在");
        }
        return chapter;
    }
}
