package com.k12.platform.learning.knowledgegraph;

import com.k12.platform.learning.config.Neo4jProperties;
import com.k12.platform.learning.dto.KnowledgeChapterCoverSummary;
import com.k12.platform.learning.dto.KnowledgeCoverSuggestion;
import com.k12.platform.learning.dto.KnowledgeEdgeResponse;
import com.k12.platform.learning.dto.KnowledgeGapResponse;
import com.k12.platform.learning.dto.KnowledgeGraphOverviewResponse;
import com.k12.platform.learning.dto.KnowledgeGraphStatusResponse;
import com.k12.platform.learning.dto.KnowledgeNeighborResponse;
import com.k12.platform.learning.dto.KnowledgeNextTopicResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import com.k12.platform.learning.dto.KnowledgeRecommendRequest;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.Values;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Neo4j 知识关系层：先修/相邻查询、薄弱先修缺口、下一主题推荐、资料 EXPLAINS 同步。
 * 正文仍在 pgvector，掌握度仍在 MySQL；本服务只返回稳定编码与关系路径。
 */
@Service
public class KnowledgeGraphService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeGraphService.class);
    private static final int WEAK_THRESHOLD = 60;

    private final Neo4jProperties properties;
    private final ObjectProvider<Driver> driverProvider;
    private final CourseMapper courseMapper;

    public KnowledgeGraphService(
            Neo4jProperties properties,
            ObjectProvider<Driver> driverProvider,
            CourseMapper courseMapper
    ) {
        this.properties = properties;
        this.driverProvider = driverProvider;
        this.courseMapper = courseMapper;
    }

    public KnowledgeGraphStatusResponse status() {
        if (!properties.isEnabled()) {
            return new KnowledgeGraphStatusResponse(false, false, 0, "Neo4j 未启用");
        }
        Driver driver = driverProvider.getIfAvailable();
        if (driver == null) {
            return new KnowledgeGraphStatusResponse(true, false, 0, "Neo4j Driver 未初始化");
        }
        try (Session session = open(driver)) {
            Long count = session.executeRead(tx -> {
                Result result = tx.run("MATCH (p:KnowledgePoint) RETURN count(p) AS c");
                return result.single().get("c").asLong();
            });
            return new KnowledgeGraphStatusResponse(true, true, count, "ok");
        } catch (RuntimeException error) {
            log.warn("Neo4j 健康检查失败: {}", error.getMessage());
            return new KnowledgeGraphStatusResponse(true, false, 0, "连接失败: " + error.getMessage());
        }
    }

    public Optional<KnowledgePointResponse> findPoint(String code) {
        if (!ready()) return Optional.empty();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (p:KnowledgePoint {code:$code})
                        RETURN p.code AS code, p.title AS title, p.stage AS stage,
                               p.difficulty AS difficulty, p.reviewStatus AS reviewStatus
                        """, Values.parameters("code", code));
                if (!result.hasNext()) return Optional.empty();
                return Optional.of(toPoint(result.single()));
            });
        }
    }

    /** 知识点目录：供章节绑定勾选；可按关键词 / 学段过滤。Neo4j 不可用时回退内置种子目录。 */
    public List<KnowledgePointResponse> listPoints(String query, String stage, int limit) {
        int capped = Math.min(Math.max(limit, 1), 500);
        if (ready()) {
            String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
            String stageFilter = StringUtils.hasText(stage) ? stage.trim() : null;
            try (Session session = open(requireDriver())) {
                List<KnowledgePointResponse> rows = session.executeRead(tx -> {
                    Result result = tx.run("""
                            MATCH (p:KnowledgePoint)
                            WHERE coalesce(p.kind, 'TOPIC') <> 'CATEGORY'
                              AND ($stage IS NULL OR p.stage = $stage)
                              AND ($q = '' OR toLower(p.code) CONTAINS $q
                                   OR toLower(coalesce(p.title, '')) CONTAINS $q
                                   OR toLower(coalesce(p.categoryTitle, '')) CONTAINS $q)
                            RETURN p.code AS code, p.title AS title, p.stage AS stage,
                                   p.difficulty AS difficulty, p.reviewStatus AS reviewStatus,
                                   p.categoryCode AS categoryCode, p.categoryTitle AS categoryTitle,
                                   coalesce(p.kind, 'TOPIC') AS kind
                            ORDER BY coalesce(p.categoryTitle, ''), p.code
                            LIMIT $limit
                            """, Values.parameters("stage", stageFilter, "q", q, "limit", capped));
                    List<KnowledgePointResponse> list = new ArrayList<>();
                    while (result.hasNext()) {
                        list.add(toPoint(result.next()));
                    }
                    return list;
                });
                if (!rows.isEmpty()) {
                    return rows;
                }
            } catch (RuntimeException error) {
                log.warn("读取 Neo4j 知识点目录失败，回退内置目录: {}", error.getMessage());
            }
        }
        return BuiltinKnowledgeCatalog.filter(query, stage, capped);
    }

    public List<KnowledgePointResponse> listChapterCovers(long courseId, long chapterId) {
        if (!ready()) return List.of();
        String refKey = chapterRefKey(courseId, chapterId);
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef {refKey:$refKey})-[:COVERS]->(p:KnowledgePoint)
                        RETURN p.code AS code, p.title AS title, p.stage AS stage,
                               p.difficulty AS difficulty, p.reviewStatus AS reviewStatus
                        ORDER BY p.code
                        """, Values.parameters("refKey", refKey));
                List<KnowledgePointResponse> rows = new ArrayList<>();
                while (result.hasNext()) {
                    rows.add(toPoint(result.next()));
                }
                return rows;
            });
        }
    }

    /**
     * 保存/更新章节时同步到图谱：标题 + 导语纯文本作为章节描述（AI 建议与检索的依据）。
     * Neo4j 未启用时静默跳过，不阻断章节保存。
     */
    public void syncChapterRef(long courseId, long chapterId, String title, String descriptionHtmlOrText) {
        if (!ready()) return;
        String refKey = chapterRefKey(courseId, chapterId);
        String description = truncate(collapseWhitespace(stripHtml(descriptionHtmlOrText)), 2000);
        String safeTitle = StringUtils.hasText(title) ? title.trim() : ("章节-" + chapterId);
        Course course = courseMapper.selectById(courseId);
        final String courseTitle = course != null ? course.getTitle() : null;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (c:CourseChapterRef {refKey:$refKey})
                        SET c.courseId = $courseId,
                            c.chapterId = $chapterId,
                            c.title = $title,
                            c.courseTitle = coalesce($courseTitle, c.courseTitle),
                            c.description = $description,
                            c.updatedAt = datetime()
                        """, Values.parameters(
                        "refKey", refKey,
                        "courseId", courseId,
                        "chapterId", chapterId,
                        "title", safeTitle,
                        "courseTitle", courseTitle,
                        "description", description
                ));
                return null;
            });
        } catch (RuntimeException error) {
            log.warn("同步章节到知识图谱失败 courseId={}, chapterId={}, err={}",
                    courseId, chapterId, error.getMessage());
        }
    }

    /**
     * 全量替换章节 COVERS；仅写入目录中已存在的 code。
     * 空列表表示清空绑定。写入前会按内置目录补齐缺失的 KnowledgePoint 节点。
     */
    public List<KnowledgePointResponse> replaceChapterCovers(
            long courseId, long chapterId, String chapterTitle, String descriptionHtmlOrText,
            List<String> knowledgeCodes
    ) {
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Neo4j 未启用，无法保存知识点绑定。请设置 K12_NEO4J_ENABLED=true 并重启 Learning 服务");
        }
        Set<String> codes = normalizeCodes(knowledgeCodes);
        ensureKnowledgePoints(codes);
        String refKey = chapterRefKey(courseId, chapterId);
        String description = truncate(collapseWhitespace(stripHtml(descriptionHtmlOrText)), 2000);
        Course course = courseMapper.selectById(courseId);
        final String courseTitle = course != null ? course.getTitle() : null;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (c:CourseChapterRef {refKey:$refKey})
                        SET c.courseId = $courseId,
                            c.chapterId = $chapterId,
                            c.title = coalesce($title, c.title),
                            c.courseTitle = coalesce($courseTitle, c.courseTitle),
                            c.description = $description,
                            c.updatedAt = datetime()
                        WITH c
                        OPTIONAL MATCH (c)-[r:COVERS]->(:KnowledgePoint)
                        DELETE r
                        """, Values.parameters(
                        "refKey", refKey,
                        "courseId", courseId,
                        "chapterId", chapterId,
                        "title", chapterTitle,
                        "courseTitle", courseTitle,
                        "description", description
                ));
                if (!codes.isEmpty()) {
                    tx.run("""
                            MATCH (c:CourseChapterRef {refKey:$refKey})
                            UNWIND $codes AS code
                            MATCH (p:KnowledgePoint {code:code})
                            MERGE (c)-[r:COVERS]->(p)
                            SET r.source = 'manual', r.updatedAt = datetime()
                            """, Values.parameters("refKey", refKey, "codes", codes));
                }
                return null;
            });
        }
        return listChapterCovers(courseId, chapterId);
    }

    /** 把待绑定编码 MERGE 成 KnowledgePoint，优先使用内置目录元数据。 */
    void ensureKnowledgePoints(Set<String> codes) {
        if (codes == null || codes.isEmpty() || !ready()) return;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String code : codes) {
            if (!StringUtils.hasText(code)) continue;
            KnowledgePointResponse meta = BuiltinKnowledgeCatalog.find(code.trim());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", code.trim());
            row.put("title", meta != null ? meta.title() : code.trim());
            row.put("stage", meta != null ? meta.stage() : null);
            row.put("difficulty", meta != null ? meta.difficulty() : null);
            row.put("categoryCode", meta != null ? meta.categoryCode() : null);
            row.put("categoryTitle", meta != null ? meta.categoryTitle() : null);
            row.put("kind", meta != null && StringUtils.hasText(meta.kind()) ? meta.kind() : "TOPIC");
            rows.add(row);
        }
        if (rows.isEmpty()) return;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        UNWIND $rows AS row
                        MERGE (p:KnowledgePoint {code:row.code})
                        SET p.title = coalesce(row.title, p.title),
                            p.stage = coalesce(row.stage, p.stage),
                            p.difficulty = coalesce(row.difficulty, p.difficulty),
                            p.categoryCode = coalesce(row.categoryCode, p.categoryCode),
                            p.categoryTitle = coalesce(row.categoryTitle, p.categoryTitle),
                            p.kind = coalesce(row.kind, p.kind, 'TOPIC'),
                            p.reviewStatus = coalesce(p.reviewStatus, 'APPROVED'),
                            p.updatedAt = datetime()
                        """, Values.parameters("rows", rows));
                return null;
            });
        }
    }

    /** 同步完整内置目录（大类 + 子知识点 + HAS_CHILD/先修边）。 */
    public void syncExpandedCatalog() {
        if (!ready()) return;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (KnowledgePointResponse point : BuiltinKnowledgeCatalog.allNodes()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", point.code());
            row.put("title", point.title());
            row.put("stage", point.stage());
            row.put("difficulty", point.difficulty());
            row.put("categoryCode", point.categoryCode());
            row.put("categoryTitle", point.categoryTitle());
            row.put("kind", point.kind() != null ? point.kind() : "TOPIC");
            rows.add(row);
        }
        List<Map<String, Object>> edgeRows = new ArrayList<>();
        for (KnowledgeEdgeResponse edge : BuiltinKnowledgeCatalog.seedEdges()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("from", edge.fromCode());
            row.put("to", edge.toCode());
            row.put("relation", edge.relation());
            edgeRows.add(row);
        }
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        UNWIND $rows AS row
                        MERGE (p:KnowledgePoint {code:row.code})
                        SET p.title = row.title,
                            p.stage = row.stage,
                            p.difficulty = row.difficulty,
                            p.categoryCode = row.categoryCode,
                            p.categoryTitle = row.categoryTitle,
                            p.kind = row.kind,
                            p.reviewStatus = 'APPROVED',
                            p.updatedAt = datetime()
                        """, Values.parameters("rows", rows));
                tx.run("""
                        UNWIND $edges AS edge
                        MATCH (a:KnowledgePoint {code:edge.from})
                        MATCH (b:KnowledgePoint {code:edge.to})
                        FOREACH (_ IN CASE WHEN edge.relation = 'HAS_CHILD' THEN [1] ELSE [] END |
                          MERGE (a)-[r:HAS_CHILD]->(b) SET r.source = 'catalog', r.updatedAt = datetime()
                        )
                        FOREACH (_ IN CASE WHEN edge.relation = 'PREREQUISITE_OF' THEN [1] ELSE [] END |
                          MERGE (a)-[r:PREREQUISITE_OF]->(b) SET r.source = 'catalog', r.updatedAt = datetime()
                        )
                        FOREACH (_ IN CASE WHEN edge.relation = 'RELATED_TO' THEN [1] ELSE [] END |
                          MERGE (a)-[r:RELATED_TO]->(b) SET r.source = 'catalog', r.updatedAt = datetime()
                        )
                        """, Values.parameters("edges", edgeRows));
                return null;
            });
            log.info("已同步扩展知识目录：nodes={}, edges={}", rows.size(), edgeRows.size());
        } catch (RuntimeException error) {
            log.warn("同步扩展知识目录失败: {}", error.getMessage());
        }
    }

    /** 某知识点被哪些课程章节 COVERS（学生端课程推荐）。跳过 formal-demo（courseId≤0）。 */
    public List<Map<String, Object>> listChaptersCovering(String knowledgeCode) {
        if (!ready() || !StringUtils.hasText(knowledgeCode)) {
            return List.of();
        }
        try (Session session = open(requireDriver())) {
            List<Map<String, Object>> rows = session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef)-[:COVERS]->(p:KnowledgePoint {code:$code})
                        WHERE coalesce(c.courseId, 0) > 0
                        RETURN c.courseId AS courseId, c.chapterId AS chapterId,
                               c.title AS title, c.description AS description,
                               c.courseTitle AS courseTitle, c.refKey AS refKey
                        ORDER BY c.courseId, c.chapterId
                        LIMIT 12
                        """, Values.parameters("code", knowledgeCode.trim()));
                List<Map<String, Object>> list = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    Map<String, Object> row = new LinkedHashMap<>();
                    long courseId = record.get("courseId").isNull() ? 0L : record.get("courseId").asLong();
                    if (courseId < 1) {
                        continue;
                    }
                    row.put("courseId", courseId);
                    if (!record.get("chapterId").isNull()) {
                        row.put("chapterId", record.get("chapterId").asLong());
                    }
                    row.put("title", record.get("title").asString(null));
                    row.put("chapterTitle", record.get("title").asString(null));
                    row.put("description", record.get("description").asString(null));
                    row.put("courseTitle", record.get("courseTitle").asString(null));
                    row.put("refKey", record.get("refKey").asString(null));
                    list.add(row);
                }
                return list;
            });
            for (Map<String, Object> row : rows) {
                Object rawId = row.get("courseId");
                if (!(rawId instanceof Number number)) {
                    continue;
                }
                if (StringUtils.hasText((String) row.get("courseTitle"))) {
                    continue;
                }
                Course course = courseMapper.selectById(number.longValue());
                if (course != null && StringUtils.hasText(course.getTitle())) {
                    row.put("courseTitle", course.getTitle());
                }
            }
            return rows;
        } catch (RuntimeException error) {
            log.warn("读取 COVERS 章节失败 code={}, err={}", knowledgeCode, error.getMessage());
            return List.of();
        }
    }

    public void removeChapterCovers(long courseId, long chapterId) {
        if (!ready()) return;
        String refKey = chapterRefKey(courseId, chapterId);
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MATCH (c:CourseChapterRef {refKey:$refKey})
                        DETACH DELETE c
                        """, Values.parameters("refKey", refKey));
                return null;
            });
        } catch (RuntimeException error) {
            log.warn("删除章节图节点失败 courseId={}, chapterId={}, err={}",
                    courseId, chapterId, error.getMessage());
        }
    }

    /** 本地目录匹配建议（大模型不可用时的兜底）。 */
    public List<KnowledgeCoverSuggestion> suggestCoversLexical(
            String title, String content, String stage, int limit
    ) {
        List<KnowledgePointResponse> catalog = listPoints(null, stage, 500);
        if (catalog.isEmpty()) {
            catalog = listPoints(null, null, 500);
        }
        return scoreAgainstCatalog(title, content, catalog, limit);
    }

    public static List<KnowledgeCoverSuggestion> scoreAgainstCatalog(
            String title, String content, List<KnowledgePointResponse> catalog, int limit
    ) {
        String haystack = normalizeText((title == null ? "" : title) + " " + stripHtml(content));
        if (!StringUtils.hasText(haystack) || catalog == null || catalog.isEmpty()) {
            return List.of();
        }
        List<KnowledgeCoverSuggestion> scored = new ArrayList<>();
        for (KnowledgePointResponse point : catalog) {
            if (point == null || !StringUtils.hasText(point.code())) continue;
            double score = 0;
            List<String> reasons = new ArrayList<>();
            String pointTitle = point.title() == null ? "" : point.title().trim();
            if (StringUtils.hasText(pointTitle) && haystack.contains(normalizeText(pointTitle))) {
                score += 10;
                reasons.add("标题命中「" + pointTitle + "」");
            } else if (StringUtils.hasText(pointTitle)) {
                for (String token : significantTokens(pointTitle)) {
                    if (haystack.contains(token)) {
                        score += 3;
                        reasons.add("关键词「" + token + "」");
                        break;
                    }
                }
            }
            for (String segment : point.code().split("[._-]")) {
                if (segment.length() >= 4 && haystack.contains(segment.toLowerCase(Locale.ROOT))) {
                    score += 2;
                    reasons.add("编码片段 " + segment);
                    break;
                }
            }
            if (score > 0) {
                scored.add(new KnowledgeCoverSuggestion(
                        point.code(),
                        point.title(),
                        score,
                        reasons.isEmpty() ? "目录匹配" : String.join("；", reasons)
                ));
            }
        }
        scored.sort(Comparator.comparingDouble(KnowledgeCoverSuggestion::score).reversed()
                .thenComparing(KnowledgeCoverSuggestion::code));
        int capped = Math.min(Math.max(limit, 1), 20);
        if (scored.size() <= capped) return scored;
        return scored.subList(0, capped);
    }

    static String chapterRefKey(long courseId, long chapterId) {
        return courseId + ":" + chapterId;
    }

    static Set<String> normalizeCodes(List<String> knowledgeCodes) {
        Set<String> codes = new LinkedHashSet<>();
        if (knowledgeCodes == null) return codes;
        for (String code : knowledgeCodes) {
            if (StringUtils.hasText(code)) {
                codes.add(code.trim());
            }
        }
        return codes;
    }

    public static String stripHtml(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("(?is)<[^>]+>", " ");
    }

    static String normalizeText(String raw) {
        if (raw == null) return "";
        return raw.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    public static String collapseWhitespace(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("\\s+", " ").trim();
    }

    static String truncate(String raw, int max) {
        if (raw == null) return "";
        if (raw.length() <= max) return raw;
        return raw.substring(0, max);
    }

    static List<String> significantTokens(String title) {
        List<String> tokens = new ArrayList<>();
        for (String part : title.split("[\\s/、，,；;：:（）()\\[\\]|-]")) {
            String token = part.trim().toLowerCase(Locale.ROOT);
            if (token.length() >= 2) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    public List<KnowledgeNeighborResponse> neighbors(String code) {
        if (!ready()) return List.of();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (p:KnowledgePoint {code:$code})-[r:PREREQUISITE_OF|RELATED_TO]-(n:KnowledgePoint)
                        RETURN n.code AS code, n.title AS title, type(r) AS relation,
                               CASE WHEN startNode(r)=p THEN 'OUT' ELSE 'IN' END AS direction
                        ORDER BY relation, code
                        """, Values.parameters("code", code));
                List<KnowledgeNeighborResponse> rows = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    rows.add(new KnowledgeNeighborResponse(
                            record.get("code").asString(),
                            record.get("title").asString(null),
                            record.get("relation").asString(),
                            record.get("direction").asString()
                    ));
                }
                return rows;
            });
        }
    }

    public List<KnowledgeGapResponse> prerequisiteGaps(String code, Map<String, Integer> masteryByCode) {
        if (!ready()) return List.of();
        Map<String, Integer> mastery = masteryByCode == null ? Map.of() : masteryByCode;
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (pre:KnowledgePoint)-[:PREREQUISITE_OF]->(p:KnowledgePoint {code:$code})
                        RETURN pre.code AS code, pre.title AS title
                        ORDER BY code
                        """, Values.parameters("code", code));
                List<KnowledgeGapResponse> gaps = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    String preCode = record.get("code").asString();
                    Integer percent = mastery.get(preCode);
                    boolean weak = percent == null || percent < WEAK_THRESHOLD;
                    if (weak) {
                        String title = record.get("title").asString(null);
                        gaps.add(new KnowledgeGapResponse(
                                preCode,
                                StringUtils.hasText(title) ? title : BuiltinKnowledgeCatalog.titleForCode(preCode),
                                percent,
                                true
                        ));
                    }
                }
                return gaps;
            });
        }
    }

    public List<KnowledgeNextTopicResponse> recommendNext(KnowledgeRecommendRequest request) {
        if (!ready() || request == null || !StringUtils.hasText(request.focusCode())) {
            return List.of();
        }
        Map<String, Integer> mastery = new HashMap<>();
        if (request.mastery() != null) {
            for (KnowledgeRecommendRequest.MasteryHint hint : request.mastery()) {
                if (hint != null && StringUtils.hasText(hint.knowledgeCode()) && hint.masteryPercent() != null) {
                    mastery.put(hint.knowledgeCode().trim(), hint.masteryPercent());
                }
            }
        }
        String focus = request.focusCode().trim();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (p:KnowledgePoint {code:$code})-[:PREREQUISITE_OF]->(next:KnowledgePoint)
                        OPTIONAL MATCH (pre:KnowledgePoint)-[:PREREQUISITE_OF]->(next)
                        RETURN next.code AS code, next.title AS title,
                               collect(DISTINCT {code: pre.code, title: pre.title}) AS prerequisites
                        ORDER BY code
                        """, Values.parameters("code", focus));
                List<KnowledgeNextTopicResponse> rows = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    String nextCode = record.get("code").asString();
                    List<String> missingCodes = new ArrayList<>();
                    List<String> missingTitles = new ArrayList<>();
                    if (!record.get("prerequisites").isNull()) {
                        for (org.neo4j.driver.Value value : record.get("prerequisites").values()) {
                            if (value == null || value.isNull()) continue;
                            String preCode = value.get("code").isNull() ? null : value.get("code").asString(null);
                            String preTitle = value.get("title").isNull() ? null : value.get("title").asString(null);
                            if (!StringUtils.hasText(preCode) || focus.equals(preCode)) continue;
                            Integer percent = mastery.get(preCode);
                            if (percent != null && percent >= WEAK_THRESHOLD) continue;
                            missingCodes.add(preCode);
                            String displayTitle = StringUtils.hasText(preTitle)
                                    ? preTitle
                                    : BuiltinKnowledgeCatalog.titleForCode(preCode);
                            missingTitles.add(displayTitle);
                        }
                    }
                    String reason = missingTitles.isEmpty()
                            ? "先修已基本掌握，可继续学习该主题"
                            : "建议先补齐先修：「" + String.join("」「", missingTitles) + "」";
                    rows.add(new KnowledgeNextTopicResponse(
                            nextCode,
                            Optional.ofNullable(record.get("title").asString(null))
                                    .filter(StringUtils::hasText)
                                    .orElseGet(() -> BuiltinKnowledgeCatalog.titleForCode(nextCode)),
                            reason,
                            missingCodes
                    ));
                }
                return rows;
            });
        }
    }

    /** 资料入库成功后：建立 KnowledgeDocumentRef -[:EXPLAINS]-> KnowledgePoint，并写入简介描述。 */
    public void syncDocumentExplains(
            String documentId, String knowledgeCode, String title, String description
    ) {
        if (!ready() || !StringUtils.hasText(documentId) || !StringUtils.hasText(knowledgeCode)) {
            return;
        }
        ensureKnowledgePoints(Set.of(knowledgeCode.trim()));
        String safeDescription = truncate(collapseWhitespace(stripHtml(description)), 2000);
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (d:KnowledgeDocumentRef {documentId:$documentId})
                        SET d.title = coalesce($title, d.title),
                            d.description = $description,
                            d.updatedAt = datetime()
                        WITH d
                        MATCH (p:KnowledgePoint {code:$code})
                        MERGE (d)-[r:EXPLAINS]->(p)
                        SET r.source = 'teaching-resource', r.updatedAt = datetime()
                        """, Values.parameters(
                        "documentId", documentId,
                        "title", title,
                        "description", safeDescription,
                        "code", knowledgeCode.trim()
                ));
                return null;
            });
        } catch (RuntimeException error) {
            log.warn("同步资料 EXPLAINS 失败 documentId={}, code={}, err={}",
                    documentId, knowledgeCode, error.getMessage());
        }
    }

    /** 兼容旧调用：无简介时仍写边。 */
    public void syncDocumentExplains(String documentId, String knowledgeCode, String title) {
        syncDocumentExplains(documentId, knowledgeCode, title, null);
    }

    public void removeDocumentExplains(String documentId) {
        if (!ready() || !StringUtils.hasText(documentId)) return;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MATCH (d:KnowledgeDocumentRef {documentId:$documentId})
                        DETACH DELETE d
                        """, Values.parameters("documentId", documentId));
                return null;
            });
        } catch (RuntimeException error) {
            log.warn("删除资料图节点失败 documentId={}, err={}", documentId, error.getMessage());
        }
    }

    public KnowledgeGraphOverviewResponse overview() {
        KnowledgeGraphStatusResponse graphStatus = status();
        List<KnowledgePointResponse> points = listPoints(null, null, 500);
        List<KnowledgeEdgeResponse> edges;
        List<KnowledgeChapterCoverSummary> chapters;
        int explains;
        if (ready()) {
            edges = listEdges();
            chapters = listChapterCoverSummaries();
            explains = countExplains();
            if (edges.isEmpty() && !points.isEmpty()) {
                edges = BuiltinKnowledgeCatalog.seedEdges();
            }
        } else {
            edges = BuiltinKnowledgeCatalog.seedEdges();
            chapters = List.of();
            explains = 0;
        }
        boolean hasPoints = !points.isEmpty();
        boolean hasPrereq = edges.stream().anyMatch(e -> "PREREQUISITE_OF".equals(e.relation()));
        boolean hasCovers = !chapters.isEmpty();
        boolean hasExplains = explains > 0;
        String summary;
        if (!graphStatus.enabled()) {
            summary = "Neo4j 未启用：展示内置种子图预览；开启后可保存章节绑定与资料讲解边。";
        } else if (!graphStatus.ready()) {
            summary = "Neo4j 已配置但未连通：" + graphStatus.message();
        } else if (!hasCovers && !hasExplains) {
            summary = "图谱已就绪。请为章节绑定 COVERS，并为资料填写 knowledgeCode 后入库，以打通教学闭环。";
        } else {
            summary = "教学闭环运行中：知识点 " + points.size() + "、关系 " + edges.size()
                    + "、章节覆盖 " + chapters.size() + "、资料讲解 " + explains + "。";
        }
        return new KnowledgeGraphOverviewResponse(
                graphStatus,
                points,
                edges,
                chapters,
                explains,
                new KnowledgeGraphOverviewResponse.TeachingLoopStatus(
                        graphStatus.ready(),
                        hasPoints,
                        hasPrereq,
                        hasCovers,
                        hasExplains,
                        summary
                )
        );
    }

    public List<KnowledgeEdgeResponse> listEdges() {
        if (!ready()) return BuiltinKnowledgeCatalog.seedEdges();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (a:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO]->(b:KnowledgePoint)
                        RETURN a.code AS fromCode, b.code AS toCode, type(r) AS relation
                        ORDER BY relation, fromCode, toCode
                        """);
                List<KnowledgeEdgeResponse> rows = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    rows.add(new KnowledgeEdgeResponse(
                            record.get("fromCode").asString(),
                            record.get("toCode").asString(),
                            record.get("relation").asString()
                    ));
                }
                return rows;
            });
        } catch (RuntimeException error) {
            log.warn("读取图谱关系失败，回退种子边: {}", error.getMessage());
            return BuiltinKnowledgeCatalog.seedEdges();
        }
    }

    public List<KnowledgeChapterCoverSummary> listChapterCoverSummaries() {
        if (!ready()) return List.of();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef)
                        OPTIONAL MATCH (c)-[:COVERS]->(p:KnowledgePoint)
                        RETURN c.courseId AS courseId, c.chapterId AS chapterId,
                               c.title AS title, c.description AS description,
                               collect(p.code) AS codes
                        ORDER BY courseId, chapterId
                        """);
                List<KnowledgeChapterCoverSummary> rows = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    if (record.get("courseId").isNull() || record.get("chapterId").isNull()) continue;
                    List<String> codes = record.get("codes").isNull()
                            ? List.of()
                            : record.get("codes").asList(value -> value.isNull() ? null : value.asString())
                            .stream().filter(StringUtils::hasText).toList();
                    rows.add(new KnowledgeChapterCoverSummary(
                            record.get("courseId").asLong(),
                            record.get("chapterId").asLong(),
                            record.get("title").asString(null),
                            record.get("description").asString(null),
                            codes
                    ));
                }
                return rows;
            });
        } catch (RuntimeException error) {
            log.warn("读取章节覆盖失败: {}", error.getMessage());
            return List.of();
        }
    }

    public int countExplains() {
        if (!ready()) return 0;
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("MATCH ()-[r:EXPLAINS]->(:KnowledgePoint) RETURN count(r) AS c");
                return (int) result.single().get("c").asLong();
            });
        } catch (RuntimeException error) {
            return 0;
        }
    }

    public Map<String, Object> teachingContext(String focusCode, Map<String, Integer> masteryByCode) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("enabled", properties.isEnabled());
        payload.put("ready", ready());
        if (!ready() || !StringUtils.hasText(focusCode)) {
            payload.put("focusCode", focusCode);
            payload.put("neighbors", List.of());
            payload.put("prerequisiteGaps", List.of());
            payload.put("nextTopics", List.of());
            payload.put("explains", List.of());
            payload.put("coveredChapters", List.of());
            return payload;
        }
        payload.put("focusCode", focusCode);
        findPoint(focusCode).ifPresentOrElse(
                point -> {
                    payload.put("focusTitle", point.title());
                    payload.put("focusStage", point.stage());
                },
                () -> payload.put("focusTitle", null)
        );
        payload.put("neighbors", neighbors(focusCode));
        payload.put("prerequisiteGaps", prerequisiteGaps(focusCode, masteryByCode));
        payload.put("nextTopics", recommendNext(new KnowledgeRecommendRequest(focusCode,
                masteryByCode == null ? List.of() : masteryByCode.entrySet().stream()
                        .map(e -> new KnowledgeRecommendRequest.MasteryHint(e.getKey(), e.getValue()))
                        .toList())));
        payload.put("explains", listExplainsForFocus(focusCode));
        LinkedHashMap<String, Map<String, Object>> covered = new LinkedHashMap<>();
        for (String code : BuiltinKnowledgeCatalog.relatedExplainCodes(focusCode)) {
            for (Map<String, Object> chapter : listChaptersCovering(code)) {
                Object refKey = chapter.get("refKey");
                String key = refKey != null ? String.valueOf(refKey)
                        : (chapter.get("courseId") + ":" + chapter.get("chapterId"));
                covered.putIfAbsent(key, chapter);
            }
        }
        payload.put("coveredChapters", new ArrayList<>(covered.values()));
        return payload;
    }

    /** 焦点及其同簇知识点的讲解资料（提示词讲义也服务幻觉主题）。 */
    public List<Map<String, Object>> listExplainsForFocus(String focusCode) {
        if (!ready() || !StringUtils.hasText(focusCode)) {
            return List.of();
        }
        LinkedHashMap<String, Map<String, Object>> byDocument = new LinkedHashMap<>();
        for (String code : BuiltinKnowledgeCatalog.relatedExplainCodes(focusCode)) {
            for (Map<String, Object> row : listExplains(code)) {
                Object documentId = row.get("documentId");
                if (documentId == null) {
                    continue;
                }
                String key = String.valueOf(documentId);
                byDocument.putIfAbsent(key, row);
            }
        }
        return new ArrayList<>(byDocument.values());
    }

    /** 某知识点下的讲解资料（GraphRAG 候选入口）。 */
    public List<Map<String, Object>> listExplains(String knowledgeCode) {
        if (!ready() || !StringUtils.hasText(knowledgeCode)) return List.of();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (d:KnowledgeDocumentRef)-[:EXPLAINS]->(p:KnowledgePoint {code:$code})
                        RETURN d.documentId AS documentId, d.title AS title, d.description AS description
                        ORDER BY d.updatedAt DESC
                        LIMIT 20
                        """, Values.parameters("code", knowledgeCode.trim()));
                List<Map<String, Object>> rows = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("documentId", record.get("documentId").asString(null));
                    row.put("title", record.get("title").asString(null));
                    row.put("description", record.get("description").asString(null));
                    rows.add(row);
                }
                return rows;
            });
        } catch (RuntimeException error) {
            log.warn("读取 EXPLAINS 失败 code={}, err={}", knowledgeCode, error.getMessage());
            return List.of();
        }
    }

    public void ensureSchemaAndSeed() {
        if (!properties.isEnabled() || !properties.isSeedOnStartup()) {
            return;
        }
        Driver driver = driverProvider.getIfAvailable();
        if (driver == null) return;
        try {
            runClasspathCypher(driver, "neo4j/001_constraints.cypher");
            runClasspathCypher(driver, "neo4j/002_seed_ai_literacy.cypher");
            runClasspathCypher(driver, "neo4j/003_seed_demo_teaching_loop.cypher");
            runClasspathCypher(driver, "neo4j/004_cleanup_formal_demo_docs.cypher");
            syncExpandedCatalog();
            log.info("Neo4j 约束、AI 通识种子图与正式演示闭环已应用");
        } catch (Exception error) {
            log.warn("Neo4j 种子初始化失败（教学将降级为无图导航）: {}", error.getMessage());
        }
    }

    public void seedNow() {
        if (!properties.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Neo4j 未启用");
        }
        Driver driver = requireDriver();
        try {
            runClasspathCypher(driver, "neo4j/001_constraints.cypher");
            runClasspathCypher(driver, "neo4j/002_seed_ai_literacy.cypher");
            runClasspathCypher(driver, "neo4j/003_seed_demo_teaching_loop.cypher");
            runClasspathCypher(driver, "neo4j/004_cleanup_formal_demo_docs.cypher");
            syncExpandedCatalog();
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "读取 Cypher 失败", error);
        }
    }

    private void runClasspathCypher(Driver driver, String classpath) throws IOException {
        ClassPathResource resource = new ClassPathResource(classpath);
        if (!resource.exists()) {
            throw new IOException("缺少 " + classpath);
        }
        String script = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        List<String> statements = splitCypher(script);
        try (Session session = open(driver)) {
            for (String statement : statements) {
                session.executeWrite(tx -> {
                    tx.run(statement);
                    return null;
                });
            }
        }
    }

    /** 先去掉整行 // 注释，再按分号切句，避免注释里的 ";" 被当成语句分隔符。 */
    static List<String> splitCypher(String script) {
        String withoutLineComments = script.replaceAll("(?m)^\\s*//.*$", "");
        String[] parts = withoutLineComments.split(";");
        List<String> statements = new ArrayList<>();
        for (String part : parts) {
            String cleaned = part.trim();
            if (StringUtils.hasText(cleaned)) {
                statements.add(cleaned);
            }
        }
        return statements;
    }

    private boolean ready() {
        return properties.isEnabled() && driverProvider.getIfAvailable() != null;
    }

    private Driver requireDriver() {
        Driver driver = driverProvider.getIfAvailable();
        if (driver == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Neo4j 不可用");
        }
        return driver;
    }

    private Session open(Driver driver) {
        String database = StringUtils.hasText(properties.getDatabase()) ? properties.getDatabase() : "neo4j";
        return driver.session(SessionConfig.forDatabase(database));
    }

    private static KnowledgePointResponse toPoint(Record record) {
        Integer difficulty = record.get("difficulty").isNull() ? null : record.get("difficulty").asInt();
        String code = record.get("code").asString();
        String categoryCode = optionalString(record, "categoryCode");
        String categoryTitle = optionalString(record, "categoryTitle");
        String kind = optionalString(record, "kind");
        KnowledgePointResponse builtin = BuiltinKnowledgeCatalog.find(code);
        if (builtin != null) {
            if (!StringUtils.hasText(categoryCode)) {
                categoryCode = builtin.categoryCode();
            }
            if (!StringUtils.hasText(categoryTitle)) {
                categoryTitle = builtin.categoryTitle();
            }
            if (!StringUtils.hasText(kind)) {
                kind = builtin.kind();
            }
        }
        return new KnowledgePointResponse(
                code,
                record.get("title").asString(null),
                record.get("stage").asString(null),
                difficulty,
                record.get("reviewStatus").asString(null),
                categoryCode,
                categoryTitle,
                kind != null ? kind : "TOPIC"
        );
    }

    private static String optionalString(Record record, String key) {
        if (!record.keys().contains(key) || record.get(key).isNull()) {
            return null;
        }
        return record.get(key).asString(null);
    }
}
