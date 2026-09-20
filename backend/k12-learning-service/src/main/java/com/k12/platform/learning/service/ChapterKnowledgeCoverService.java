package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.ChapterCoversRequest;
import com.k12.platform.learning.dto.ChapterCoversResponse;
import com.k12.platform.learning.dto.KnowledgeAlignmentItem;
import com.k12.platform.learning.dto.KnowledgeAlignmentReviewRequest;
import com.k12.platform.learning.dto.KnowledgeAlignmentReviewResponse;
import com.k12.platform.learning.dto.KnowledgeCoverSuggestion;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import com.k12.platform.learning.dto.KnowledgePointUpsertRequest;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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

    /** 章节知识点绑定仅管理员可改；教师默认只读。 */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
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

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public KnowledgePointResponse upsertPoint(KnowledgePointUpsertRequest request) {
        return knowledgeGraphService.upsertPoint(
                request.code(),
                request.title(),
                request.stages(),
                request.stage(),
                request.difficulty(),
                request.categoryCode(),
                request.categoryTitle(),
                request.kind(),
                request.parentCode(),
                request.prerequisiteCodes(),
                request.relatedCodes()
        );
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public void deletePoint(String code, boolean force) {
        knowledgeGraphService.deletePoint(code, force);
    }

    /**
     * AI/本地审查：检查已绑定知识点是否与标题+正文对应。
     * KEEP=匹配良好；REVIEW=证据不足，建议人工核对；REMOVE=几乎无关。
     */
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public KnowledgeAlignmentReviewResponse reviewAlignment(KnowledgeAlignmentReviewRequest request) {
        String title = request == null ? null : request.title();
        String content = request == null ? null : request.content();
        String stage = request == null ? null : request.stage();
        List<String> codes = request == null || request.knowledgeCodes() == null
                ? List.of()
                : request.knowledgeCodes().stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
        if (codes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请至少提供一个待审查知识点");
        }
        if (!StringUtils.hasText(title) && !StringUtils.hasText(content)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请提供标题或正文作为审查依据");
        }

        List<KnowledgePointResponse> catalog = knowledgeGraphService.listPoints(null, stage, 500);
        if (catalog.isEmpty()) {
            catalog = knowledgeGraphService.listPoints(null, null, 500);
        }
        Map<String, KnowledgePointResponse> byCode = new LinkedHashMap<>();
        for (KnowledgePointResponse point : catalog) {
            if (point != null && StringUtils.hasText(point.code())) {
                byCode.put(point.code(), point);
            }
        }

        List<KnowledgePointResponse> targetPoints = new ArrayList<>();
        for (String code : codes) {
            KnowledgePointResponse point = byCode.get(code);
            if (point == null) {
                point = knowledgeGraphService.findPoint(code).orElse(
                        new KnowledgePointResponse(code, code, stage, null, null));
            }
            targetPoints.add(point);
        }

        Map<String, KnowledgeCoverSuggestion> lexicalByCode = new LinkedHashMap<>();
        for (KnowledgeCoverSuggestion item : KnowledgeGraphService.scoreAgainstCatalog(
                title, content, targetPoints, Math.max(codes.size(), 8))) {
            lexicalByCode.put(item.code(), item);
        }

        String source = "lexical";
        Set<String> aiRecommended = new LinkedHashSet<>();
        List<KnowledgePointResponse> aiCandidates = catalog;
        List<KnowledgeCoverSuggestion> lexicalPrefilter = KnowledgeGraphService.scoreAgainstCatalog(
                title, content, catalog, 60);
        if (!lexicalPrefilter.isEmpty()) {
            List<KnowledgePointResponse> narrowed = new ArrayList<>();
            for (KnowledgeCoverSuggestion item : lexicalPrefilter) {
                KnowledgePointResponse point = byCode.get(item.code());
                if (point != null) narrowed.add(point);
            }
            if (!narrowed.isEmpty()) aiCandidates = narrowed;
        }
        List<KnowledgeCoverSuggestion> ai = suggestClient.suggest(title, content, aiCandidates, 12);
        if (!ai.isEmpty()) {
            source = "llm";
            for (KnowledgeCoverSuggestion item : ai) {
                if (item != null && StringUtils.hasText(item.code())) {
                    aiRecommended.add(item.code());
                }
            }
        }

        List<KnowledgeAlignmentItem> items = new ArrayList<>();
        int alignedCount = 0;
        int reviewCount = 0;
        for (String code : codes) {
            KnowledgePointResponse point = byCode.get(code);
            String pointTitle = point != null && StringUtils.hasText(point.title()) ? point.title() : code;
            KnowledgeCoverSuggestion lexical = lexicalByCode.get(code);
            double score = lexical == null ? 0 : lexical.score();
            boolean aiHit = aiRecommended.contains(code);
            String verdict;
            boolean aligned;
            String reason;
            if (aiHit || score >= 6) {
                verdict = "KEEP";
                aligned = true;
                alignedCount++;
                reason = aiHit
                        ? (score > 0 ? "大模型推荐且本地命中：" + lexical.reason() : "大模型推荐为相关知识点")
                        : "本地匹配良好：" + lexical.reason();
            } else if (score >= 3) {
                verdict = "REVIEW";
                aligned = false;
                reviewCount++;
                reason = "仅有弱匹配（" + lexical.reason() + "），建议人工核对导语/简介";
            } else {
                verdict = "REMOVE";
                aligned = false;
                reviewCount++;
                reason = score > 0
                        ? "匹配很弱：" + lexical.reason()
                        : "导语/简介几乎未出现该知识点关键词，建议移除或改绑";
            }
            items.add(new KnowledgeAlignmentItem(code, pointTitle, aligned, verdict, score, reason));
        }

        String summary = String.format(Locale.ROOT,
                "审查完成：%d 个匹配良好，%d 个需关注（来源：%s）",
                alignedCount, reviewCount, "llm".equals(source) ? "大模型+本地" : "本地匹配");
        return new KnowledgeAlignmentReviewResponse(items, summary, alignedCount, reviewCount, source);
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
