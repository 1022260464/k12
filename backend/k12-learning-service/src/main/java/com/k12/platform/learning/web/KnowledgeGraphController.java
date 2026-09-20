package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.KnowledgeCatalogInfoResponse;
import com.k12.platform.learning.dto.KnowledgeAlignmentReviewRequest;
import com.k12.platform.learning.dto.KnowledgeAlignmentReviewResponse;
import com.k12.platform.learning.dto.KnowledgeGapResponse;
import com.k12.platform.learning.dto.KnowledgeGraphOverviewResponse;
import com.k12.platform.learning.dto.KnowledgeGraphPurgeResult;
import com.k12.platform.learning.dto.KnowledgeGraphStatusResponse;
import com.k12.platform.learning.dto.KnowledgeNeighborResponse;
import com.k12.platform.learning.dto.KnowledgeNextTopicResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import com.k12.platform.learning.dto.KnowledgePointUpsertRequest;
import com.k12.platform.learning.dto.KnowledgeRecommendRequest;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversRequest;
import com.k12.platform.learning.dto.KnowledgeSuggestCoversResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.service.ChapterKnowledgeCoverService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
    public ApiResponse<KnowledgeGraphOverviewResponse> overview(
            @RequestParam(value = "refresh", defaultValue = "false") boolean refresh
    ) {
        return ApiResponse.ok(knowledgeGraphService.overview(refresh));
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

    /** 查看当前内存中的知识目录来源、版本与规模。 */
    @GetMapping("/admin/catalog")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeCatalogInfoResponse> catalogInfo() {
        return ApiResponse.ok(knowledgeGraphService.catalogInfo());
    }

    /** 从配置的 location 重新加载 JSON 到内存（不写 Neo4j）。 */
    @PostMapping("/admin/catalog/reload")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeCatalogInfoResponse.ReloadResult> reloadCatalog() {
        return ApiResponse.ok(knowledgeGraphService.reloadCatalog());
    }

    /**
     * 将目录同步到 Neo4j（默认先 reload）。
     * 兼容旧路径 {@code /admin/sync-catalog}。
     */
    @PostMapping({"/admin/catalog/sync", "/admin/sync-catalog"})
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeCatalogInfoResponse.SyncResult> syncCatalog(
            @RequestParam(value = "reload", defaultValue = "true") boolean reload
    ) {
        return ApiResponse.ok(knowledgeGraphService.syncCatalogToGraph(reload));
    }

    /** 清理未发布/已删课程章节引用，以及非已发布入库资料的讲解节点。 */
    @PostMapping("/admin/purge-dirty")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeGraphPurgeResult> purgeDirty() {
        return ApiResponse.ok(knowledgeGraphService.purgeDirtyGraphRefs());
    }

    /** 复查图谱中是否仍有未发布/失效引用（不删除）。 */
    @GetMapping("/admin/dirty-status")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeGraphPurgeResult> dirtyStatus() {
        return ApiResponse.ok(knowledgeGraphService.inspectDirtyGraphRefs());
    }

    @PostMapping("/admin/points")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgePointResponse> createPoint(@Valid @RequestBody KnowledgePointUpsertRequest request) {
        return ApiResponse.ok(chapterKnowledgeCoverService.upsertPoint(request));
    }

    @PutMapping("/admin/points/{code}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgePointResponse> updatePoint(
            @PathVariable("code") String code,
            @Valid @RequestBody KnowledgePointUpsertRequest request
    ) {
        if (request == null || !code.equals(request.code())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "路径编码与请求体编码须一致");
        }
        return ApiResponse.ok(chapterKnowledgeCoverService.upsertPoint(request));
    }

    @DeleteMapping("/admin/points/{code}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<Void> deletePoint(
            @PathVariable("code") String code,
            @RequestParam(value = "force", defaultValue = "false") boolean force
    ) {
        chapterKnowledgeCoverService.deletePoint(code, force);
        return ApiResponse.ok(null);
    }

    @PostMapping("/admin/review-alignment")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ApiResponse<KnowledgeAlignmentReviewResponse> reviewAlignment(
            @Valid @RequestBody KnowledgeAlignmentReviewRequest request
    ) {
        return ApiResponse.ok(chapterKnowledgeCoverService.reviewAlignment(request));
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
