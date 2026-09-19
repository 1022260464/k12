package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.KnowledgeGapResponse;
import com.k12.platform.learning.dto.KnowledgeGraphOverviewResponse;
import com.k12.platform.learning.dto.KnowledgeGraphStatusResponse;
import com.k12.platform.learning.dto.KnowledgeNeighborResponse;
import com.k12.platform.learning.dto.KnowledgeNextTopicResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import com.k12.platform.learning.dto.KnowledgeRecommendRequest;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversRequest;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.service.ChapterKnowledgeCoverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/learning/knowledge-graph")
public class KnowledgeGraphController {
    private final KnowledgeGraphService knowledgeGraphService;
    private final ChapterKnowledgeCoverService chapterKnowledgeCoverService;

    public KnowledgeGraphController(
            KnowledgeGraphService knowledgeGraphService,
            ChapterKnowledgeCoverService chapterKnowledgeCoverService
    ) {
        this.knowledgeGraphService = knowledgeGraphService;
        this.chapterKnowledgeCoverService = chapterKnowledgeCoverService;
    }

    @GetMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<KnowledgeGraphStatusResponse> status() {
        return ApiResponse.ok(knowledgeGraphService.status());
    }

    @GetMapping("/overview")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<KnowledgeGraphOverviewResponse> overview() {
        return ApiResponse.ok(knowledgeGraphService.overview());
    }

    @GetMapping("/points")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<KnowledgePointResponse>> points(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "stage", required = false) String stage,
            @RequestParam(value = "limit", defaultValue = "500") int limit
    ) {
        return ApiResponse.ok(knowledgeGraphService.listPoints(q, stage, limit));
    }

    @PostMapping("/suggest-covers")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<KnowledgeSuggestCoversResponse> suggestCovers(
            @Valid @RequestBody KnowledgeSuggestCoversRequest request
    ) {
        return ApiResponse.ok(chapterKnowledgeCoverService.suggest(request));
    }

    @GetMapping("/points/{code}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<KnowledgePointResponse> point(@PathVariable("code") String code) {
        return ApiResponse.ok(knowledgeGraphService.findPoint(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "知识点不存在或图谱未启用")));
    }

    @GetMapping("/points/{code}/neighbors")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<KnowledgeNeighborResponse>> neighbors(@PathVariable("code") String code) {
        return ApiResponse.ok(knowledgeGraphService.neighbors(code));
    }

    @GetMapping("/points/{code}/prerequisite-gaps")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<KnowledgeGapResponse>> gaps(
            @PathVariable("code") String code,
            @RequestParam(value = "mastery", required = false) List<String> masteryPairs
    ) {
        return ApiResponse.ok(knowledgeGraphService.prerequisiteGaps(code, parseMastery(masteryPairs)));
    }

    @PostMapping("/recommendations/next")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<KnowledgeNextTopicResponse>> recommend(
            @Valid @RequestBody KnowledgeRecommendRequest request
    ) {
        return ApiResponse.ok(knowledgeGraphService.recommendNext(request));
    }

    /** Agent 组装教学上下文：邻居 + 先修缺口 + 下一主题。 */
    @PostMapping("/teaching-context")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> teachingContext(@RequestBody KnowledgeRecommendRequest request) {
        Map<String, Integer> mastery = new HashMap<>();
        if (request != null && request.mastery() != null) {
            for (KnowledgeRecommendRequest.MasteryHint hint : request.mastery()) {
                if (hint != null && hint.knowledgeCode() != null && hint.masteryPercent() != null) {
                    mastery.put(hint.knowledgeCode(), hint.masteryPercent());
                }
            }
        }
        String focus = request == null ? null : request.focusCode();
        return ApiResponse.ok(knowledgeGraphService.teachingContext(focus, mastery));
    }

    @PostMapping("/admin/seed")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeGraphStatusResponse> seed() {
        knowledgeGraphService.seedNow();
        return ApiResponse.ok(knowledgeGraphService.status());
    }

    private static Map<String, Integer> parseMastery(List<String> pairs) {
        Map<String, Integer> map = new HashMap<>();
        if (pairs == null) return map;
        for (String pair : pairs) {
            if (pair == null || !pair.contains(":")) continue;
            String[] parts = pair.split(":", 2);
            try {
                map.put(parts[0].trim(), Integer.parseInt(parts[1].trim()));
            } catch (NumberFormatException ignored) {
                // skip malformed
            }
        }
        return map;
    }
}
