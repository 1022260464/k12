package com.k12.platform.learning.knowledgegraph;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.learning.config.Neo4jProperties;
import com.k12.platform.learning.dto.KnowledgeCatalogInfoResponse;
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
import com.k12.platform.learning.dto.KnowledgeGraphPurgeResult;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.service.KnowledgeGraphOverviewCache;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.neo4j.driver.TransactionContext;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final TeachingResourceMapper teachingResourceMapper;
    private final KnowledgeGraphOverviewCache overviewCache;
    private final KnowledgeCatalogStore catalogStore;

    public KnowledgeGraphService(
            Neo4jProperties properties,
            ObjectProvider<Driver> driverProvider,
            CourseMapper courseMapper,
            TeachingResourceMapper teachingResourceMapper,
            ObjectProvider<KnowledgeGraphOverviewCache> overviewCache,
            KnowledgeCatalogStore catalogStore
    ) {
        this.properties = properties;
        this.driverProvider = driverProvider;
        this.courseMapper = courseMapper;
        this.teachingResourceMapper = teachingResourceMapper;
        this.overviewCache = overviewCache.getIfAvailable();
        this.catalogStore = catalogStore;
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
                        RETURN p.code AS code, p.title AS title, p.stage AS stage, p.stages AS stages,
                               p.difficulty AS difficulty, p.reviewStatus AS reviewStatus,
                               p.categoryCode AS categoryCode, p.categoryTitle AS categoryTitle,
                               coalesce(p.kind, 'TOPIC') AS kind
                        """, Values.parameters("code", code));
                if (!result.hasNext()) return Optional.empty();
                return Optional.of(toPoint(result.single()));
            });
        }
    }

    /** 管理员新建或更新知识点节点；可选挂到分类 HAS_CHILD，并可同步先修/相关边。 */
    public KnowledgePointResponse upsertPoint(
            String code,
            String title,
            List<String> stages,
            String stage,
            Integer difficulty,
            String categoryCode,
            String categoryTitle,
            String kind,
            String parentCode,
            List<String> prerequisiteCodes,
            List<String> relatedCodes
    ) {
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识图谱未就绪，无法写入知识点");
        }
        String trimmedCode = code == null ? "" : code.trim();
        String trimmedTitle = title == null ? "" : title.trim();
        if (!StringUtils.hasText(trimmedCode) || !StringUtils.hasText(trimmedTitle)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "知识点编码与标题不能为空");
        }
        List<String> resolvedStages = KnowledgePointResponse.normalizeStages(stages, stage);
        if (resolvedStages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请至少选择一个适用学段");
        }
        String stageDisplay = KnowledgePointResponse.joinStages(resolvedStages);
        String resolvedKind = StringUtils.hasText(kind) ? kind.trim() : "TOPIC";
        String parent = StringUtils.hasText(parentCode) ? parentCode.trim() : null;
        // 分类编码在目录里多为 category.xxx；前端若只传 xxx，尝试补全。
        if (parent != null && !parent.startsWith("category.") && !parent.contains(".")) {
            parent = "category." + parent;
        }
        final String resolvedParent = parent;
        final List<String> prereqList = normalizeRelationCodes(prerequisiteCodes, trimmedCode);
        final List<String> relatedList = normalizeRelationCodes(relatedCodes, trimmedCode);
        final boolean syncRelations = prerequisiteCodes != null || relatedCodes != null;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (p:KnowledgePoint {code:$code})
                        SET p.title = $title,
                            p.stage = $stage,
                            p.stages = $stages,
                            p.difficulty = $difficulty,
                            p.categoryCode = $categoryCode,
                            p.categoryTitle = $categoryTitle,
                            p.kind = $kind,
                            p.reviewStatus = coalesce(p.reviewStatus, 'APPROVED'),
                            p.updatedAt = datetime()
                        """, Values.parameters(
                        "code", trimmedCode,
                        "title", trimmedTitle,
                        "stage", stageDisplay,
                        "stages", resolvedStages,
                        "difficulty", difficulty,
                        "categoryCode", StringUtils.hasText(categoryCode) ? categoryCode.trim() : null,
                        "categoryTitle", StringUtils.hasText(categoryTitle) ? categoryTitle.trim() : null,
                        "kind", resolvedKind
                ));
                // 分类变更时先清掉旧的「同属一类」边，避免详情已未分类但仍显示旧大类。
                tx.run("""
                        MATCH (parent)-[r:HAS_CHILD]->(child:KnowledgePoint {code:$code})
                        WHERE coalesce(parent.kind, 'TOPIC') = 'CATEGORY'
                           OR parent.code STARTS WITH 'category.'
                        DELETE r
                        """, Values.parameters("code", trimmedCode));
                if (resolvedParent != null && !resolvedParent.equals(trimmedCode)) {
                    tx.run("""
                            MATCH (parent:KnowledgePoint {code:$parent})
                            MATCH (child:KnowledgePoint {code:$code})
                            MERGE (parent)-[r:HAS_CHILD]->(child)
                            SET r.source = 'admin', r.updatedAt = datetime()
                            """, Values.parameters("parent", resolvedParent, "code", trimmedCode));
                }
                if (syncRelations) {
                    syncTopicRelations(tx, trimmedCode, prereqList, relatedList);
                }
                return null;
            });
        }
        invalidateOverviewCache();
        return findPoint(trimmedCode).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "知识点写入后未能读取"));
    }

    private static List<String> normalizeRelationCodes(List<String> codes, String selfCode) {
        if (codes == null) return List.of();
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String raw : codes) {
            if (!StringUtils.hasText(raw)) continue;
            String code = raw.trim();
            if (code.equals(selfCode)) continue;
            unique.add(code);
        }
        return List.copyOf(unique);
    }

    /**
     * 同步本节点与其它知识点的先修/相关边（不含分类 HAS_CHILD）。
     * 先修：(pre)-[:PREREQUISITE_OF]->(本节点)；相关：(本节点)-[:RELATED_TO]->(other)。
     */
    private static void syncTopicRelations(
            TransactionContext tx,
            String code,
            List<String> prerequisiteCodes,
            List<String> relatedCodes
    ) {
        tx.run("""
                MATCH (pre:KnowledgePoint)-[r:PREREQUISITE_OF]->(p:KnowledgePoint {code:$code})
                WHERE coalesce(pre.kind, 'TOPIC') <> 'CATEGORY'
                  AND NOT pre.code STARTS WITH 'category.'
                DELETE r
                """, Values.parameters("code", code));
        tx.run("""
                MATCH (p:KnowledgePoint {code:$code})-[r:RELATED_TO]-(n:KnowledgePoint)
                WHERE coalesce(n.kind, 'TOPIC') <> 'CATEGORY'
                  AND NOT n.code STARTS WITH 'category.'
                DELETE r
                """, Values.parameters("code", code));

        for (String preCode : prerequisiteCodes) {
            Result matched = tx.run("""
                    MATCH (pre:KnowledgePoint {code:$pre})
                    MATCH (p:KnowledgePoint {code:$code})
                    WHERE coalesce(pre.kind, 'TOPIC') <> 'CATEGORY'
                    MERGE (pre)-[r:PREREQUISITE_OF]->(p)
                    SET r.source = 'admin', r.updatedAt = datetime()
                    RETURN pre.code AS code
                    """, Values.parameters("pre", preCode, "code", code));
            if (!matched.hasNext()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "先修知识点不存在：" + preCode);
            }
        }
        for (String relatedCode : relatedCodes) {
            Result matched = tx.run("""
                    MATCH (p:KnowledgePoint {code:$code})
                    MATCH (n:KnowledgePoint {code:$other})
                    WHERE coalesce(n.kind, 'TOPIC') <> 'CATEGORY'
                    MERGE (p)-[r:RELATED_TO]->(n)
                    SET r.source = 'admin', r.updatedAt = datetime()
                    RETURN n.code AS code
                    """, Values.parameters("code", code, "other", relatedCode));
            if (!matched.hasNext()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "相关知识点不存在：" + relatedCode);
            }
        }
    }

    /**
     * 管理员删除知识点。若仍被章节 COVERS 或资料 EXPLAINS 引用且未 force，则拒绝。
     */
    public void deletePoint(String code, boolean force) {
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识图谱未就绪，无法删除知识点");
        }
        String trimmed = code == null ? "" : code.trim();
        if (!StringUtils.hasText(trimmed)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "知识点编码不能为空");
        }
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                Result refs = tx.run("""
                        OPTIONAL MATCH (p:KnowledgePoint {code:$code})
                        OPTIONAL MATCH (:CourseChapterRef)-[c:COVERS]->(p)
                        OPTIONAL MATCH (:KnowledgeDocumentRef)-[e:EXPLAINS]->(p)
                        RETURN p IS NOT NULL AS exists, count(c) AS covers, count(e) AS explains
                        """, Values.parameters("code", trimmed));
                Record row = refs.single();
                if (!row.get("exists").asBoolean()) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "知识点不存在");
                }
                long covers = row.get("covers").asLong();
                long explains = row.get("explains").asLong();
                if (!force && (covers > 0 || explains > 0)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "该知识点仍被 " + covers + " 个章节 / " + explains + " 份资料引用，确认后可强制删除");
                }
                tx.run("""
                        MATCH (p:KnowledgePoint {code:$code})
                        DETACH DELETE p
                        """, Values.parameters("code", trimmed));
                return null;
            });
        }
        invalidateOverviewCache();
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
                              AND ($stage IS NULL
                                   OR $stage IN coalesce(p.stages, [])
                                   OR p.stage = $stage
                                   OR (p.stages IS NULL AND p.stage CONTAINS $stage))
                              AND ($q = '' OR toLower(p.code) CONTAINS $q
                                   OR toLower(coalesce(p.title, '')) CONTAINS $q
                                   OR toLower(coalesce(p.categoryTitle, '')) CONTAINS $q)
                            RETURN p.code AS code, p.title AS title, p.stage AS stage, p.stages AS stages,
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
        return catalogStore.filter(query, stage, capped);
    }

    public List<KnowledgePointResponse> listChapterCovers(long courseId, long chapterId) {
        if (!ready()) return List.of();
        String refKey = chapterRefKey(courseId, chapterId);
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef {refKey:$refKey})-[:COVERS]->(p:KnowledgePoint)
                        RETURN p.code AS code, p.title AS title, p.stage AS stage, p.stages AS stages,
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
     * 保存/更新章节时同步到图谱：标题 + 导语纯文本作为章节描述。
     * 仅已发布课程写入/更新图节点，避免草稿课污染检索；草稿绑定请走 replaceChapterCovers（会标 published=false）。
     */
    public void syncChapterRef(long courseId, long chapterId, String title, String descriptionHtmlOrText) {
        if (!ready()) return;
        Course course = courseMapper.selectById(courseId);
        if (course == null || !Integer.valueOf(1).equals(course.getStatus())) {
            return;
        }
        String refKey = chapterRefKey(courseId, chapterId);
        String description = truncate(collapseWhitespace(stripHtml(descriptionHtmlOrText)), 2000);
        String safeTitle = StringUtils.hasText(title) ? title.trim() : ("章节-" + chapterId);
        final String courseTitle = course.getTitle();
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (c:CourseChapterRef {refKey:$refKey})
                        SET c.courseId = $courseId,
                            c.chapterId = $chapterId,
                            c.title = $title,
                            c.courseTitle = coalesce($courseTitle, c.courseTitle),
                            c.description = $description,
                            c.published = true,
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
     * 全量替换章节 COVERS；只允许绑定官方目录中已有的 code。
     * 空列表表示清空绑定。草稿课写入 published=false（仅供发布前准备，不参与检索）。
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
        requireCatalogCodes(codes);
        ensureKnowledgePoints(codes);
        String refKey = chapterRefKey(courseId, chapterId);
        String description = truncate(collapseWhitespace(stripHtml(descriptionHtmlOrText)), 2000);
        Course course = courseMapper.selectById(courseId);
        final String courseTitle = course != null ? course.getTitle() : null;
        final boolean published = course != null && Integer.valueOf(1).equals(course.getStatus());
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MERGE (c:CourseChapterRef {refKey:$refKey})
                        SET c.courseId = $courseId,
                            c.chapterId = $chapterId,
                            c.title = coalesce($title, c.title),
                            c.courseTitle = coalesce($courseTitle, c.courseTitle),
                            c.description = $description,
                            c.published = $published,
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
                        "description", description,
                        "published", published
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
        invalidateOverviewCache();
        return listChapterCovers(courseId, chapterId);
    }

    /** 课程发布后：将该课全部章节引用标为可检索。 */
    public void markCourseChapterRefsPublished(long courseId) {
        if (!ready() || courseId < 1) {
            return;
        }
        Course course = courseMapper.selectById(courseId);
        final String courseTitle = course != null ? course.getTitle() : null;
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MATCH (c:CourseChapterRef)
                        WHERE c.courseId = $courseId
                        SET c.published = true,
                            c.courseTitle = coalesce($courseTitle, c.courseTitle),
                            c.updatedAt = datetime()
                        """, Values.parameters("courseId", courseId, "courseTitle", courseTitle));
                return null;
            });
            invalidateOverviewCache();
        } catch (RuntimeException error) {
            log.warn("标记课程章节已发布失败 courseId={}, err={}", courseId, error.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "发布成功但同步图谱可见性失败：" + error.getMessage());
        }
    }

    /**
     * 清理图谱脏数据：删除未发布/已删课程的章节引用，以及非「已发布且已入库」资料的讲解节点。
     * 保留 courseId≤0 的 formal-demo 示例节点。
     */
    public KnowledgeGraphPurgeResult purgeDirtyGraphRefs() {
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Neo4j 未启用，无法清理图谱");
        }
        Set<Long> publishedCourseIds = publishedCourseIds();
        Set<String> liveDocumentIds = liveTeachingDocumentIds();

        int removedChapters;
        int removedDocs;
        try (Session session = open(requireDriver())) {
            removedChapters = session.executeWrite(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef)
                        WHERE coalesce(c.courseId, 0) > 0
                          AND NOT c.courseId IN $publishedIds
                        WITH c, c.refKey AS refKey
                        DETACH DELETE c
                        RETURN count(refKey) AS removed
                        """, Values.parameters("publishedIds", publishedCourseIds.isEmpty()
                        ? List.of(-1L)
                        : List.copyOf(publishedCourseIds)));
                return result.hasNext() ? (int) result.single().get("removed").asLong() : 0;
            });
            removedDocs = session.executeWrite(tx -> {
                Result result = tx.run("""
                        MATCH (d:KnowledgeDocumentRef)
                        WHERE d.documentId STARTS WITH 'teaching-resource-'
                          AND NOT d.documentId IN $liveIds
                        WITH d, d.documentId AS documentId
                        DETACH DELETE d
                        RETURN count(documentId) AS removed
                        """, Values.parameters("liveIds", liveDocumentIds.isEmpty()
                        ? List.of("__none__")
                        : List.copyOf(liveDocumentIds)));
                return result.hasNext() ? (int) result.single().get("removed").asLong() : 0;
            });
            // 补齐仍保留节点的 published 标记，避免旧数据缺字段
            if (!publishedCourseIds.isEmpty()) {
                session.executeWrite(tx -> {
                    tx.run("""
                            MATCH (c:CourseChapterRef)
                            WHERE c.courseId IN $publishedIds
                            SET c.published = true
                            """, Values.parameters("publishedIds", List.copyOf(publishedCourseIds)));
                    return null;
                });
            }
        } catch (RuntimeException error) {
            log.warn("清理图谱脏数据失败: {}", error.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "清理图谱失败：" + error.getMessage());
        }
        invalidateOverviewCache();
        DirtyGraphCounts remaining = countDirtyGraphRefs(publishedCourseIds, liveDocumentIds);
        String message;
        if (remaining.isClean()) {
            message = String.format(
                    "已清理脏数据：删除 %d 个失效章节引用、%d 个无效资料节点。复查：图谱中已无未发布脏数据。",
                    removedChapters, removedDocs);
        } else {
            message = String.format(
                    "已清理：删除章节 %d、资料 %d；仍残留章节 %d、资料 %d，请再试一次或检查 Neo4j 连通。",
                    removedChapters, removedDocs, remaining.chapterRefs(), remaining.documentRefs());
        }
        return new KnowledgeGraphPurgeResult(
                removedChapters,
                removedDocs,
                remaining.chapterRefs(),
                remaining.documentRefs(),
                message
        );
    }

    /** 只统计、不删除：用于复查是否还有未发布/失效图引用。 */
    public KnowledgeGraphPurgeResult inspectDirtyGraphRefs() {
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Neo4j 未启用，无法检查图谱");
        }
        DirtyGraphCounts dirty = countDirtyGraphRefs(publishedCourseIds(), liveTeachingDocumentIds());
        String message = dirty.isClean()
                ? "复查通过：未发现未发布课程章节引用或无效资料讲解节点。"
                : String.format("仍有脏数据：未发布/失效章节引用 %d，无效资料节点 %d。",
                dirty.chapterRefs(), dirty.documentRefs());
        return new KnowledgeGraphPurgeResult(0, 0, dirty.chapterRefs(), dirty.documentRefs(), message);
    }

    private record DirtyGraphCounts(int chapterRefs, int documentRefs) {
        boolean isClean() {
            return chapterRefs <= 0 && documentRefs <= 0;
        }
    }

    private Set<Long> publishedCourseIds() {
        return courseMapper.selectList(Wrappers.lambdaQuery(Course.class)
                        .eq(Course::getStatus, 1)
                        .select(Course::getId))
                .stream()
                .map(Course::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<String> liveTeachingDocumentIds() {
        return teachingResourceMapper.selectList(Wrappers.lambdaQuery(TeachingResource.class)
                        .eq(TeachingResource::getStatus, "PUBLISHED")
                        .eq(TeachingResource::getRagIndexStatus, "INDEXED")
                        .select(TeachingResource::getId))
                .stream()
                .map(TeachingResource::getId)
                .filter(id -> id != null && id > 0)
                .map(id -> "teaching-resource-" + id)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private DirtyGraphCounts countDirtyGraphRefs(Set<Long> publishedCourseIds, Set<String> liveDocumentIds) {
        try (Session session = open(requireDriver())) {
            int dirtyChapters = session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef)
                        WHERE coalesce(c.courseId, 0) > 0
                          AND NOT c.courseId IN $publishedIds
                        RETURN count(c) AS dirty
                        """, Values.parameters("publishedIds", publishedCourseIds.isEmpty()
                        ? List.of(-1L)
                        : List.copyOf(publishedCourseIds)));
                return result.hasNext() ? (int) result.single().get("dirty").asLong() : 0;
            });
            int dirtyDocs = session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (d:KnowledgeDocumentRef)
                        WHERE d.documentId STARTS WITH 'teaching-resource-'
                          AND NOT d.documentId IN $liveIds
                        RETURN count(d) AS dirty
                        """, Values.parameters("liveIds", liveDocumentIds.isEmpty()
                        ? List.of("__none__")
                        : List.copyOf(liveDocumentIds)));
                return result.hasNext() ? (int) result.single().get("dirty").asLong() : 0;
            });
            return new DirtyGraphCounts(dirtyChapters, dirtyDocs);
        } catch (RuntimeException error) {
            log.warn("统计图谱脏数据失败: {}", error.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "检查图谱失败：" + error.getMessage());
        }
    }

    /** 把待绑定编码 MERGE 成 KnowledgePoint，仅使用官方目录元数据（调用前须先 requireCatalogCodes）。 */
    void ensureKnowledgePoints(Set<String> codes) {
        if (codes == null || codes.isEmpty() || !ready()) return;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String code : codes) {
            if (!StringUtils.hasText(code)) continue;
            KnowledgePointResponse meta = catalogStore.find(code.trim());
            if (meta == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", code.trim());
            row.put("title", meta.title());
            row.put("stage", meta.stage());
            row.put("stages", meta.resolvedStages());
            row.put("difficulty", meta.difficulty());
            row.put("categoryCode", meta.categoryCode());
            row.put("categoryTitle", meta.categoryTitle());
            row.put("kind", StringUtils.hasText(meta.kind()) ? meta.kind() : "TOPIC");
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
                            p.stages = CASE
                              WHEN row.stages IS NOT NULL AND size(row.stages) > 0 THEN row.stages
                              ELSE coalesce(p.stages, CASE WHEN row.stage IS NULL THEN [] ELSE [row.stage] END)
                            END,
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

    public KnowledgeCatalogInfoResponse catalogInfo() {
        return catalogStore.info();
    }

    public KnowledgeCatalogInfoResponse.ReloadResult reloadCatalog() {
        KnowledgeCatalogInfoResponse info = catalogStore.reload();
        invalidateOverviewCache();
        return new KnowledgeCatalogInfoResponse.ReloadResult(
                info,
                true,
                "目录已重新读入。要让图谱里的点也跟着变，请再点「写进图谱」。"
        );
    }

    /**
     * 先可选重载 JSON，再按目录 MERGE 覆盖 Neo4j 已有节点。
     * @param reloadFirst true 时先从配置 location 重新读入，避免改文件后仍用旧内存快照。
     */
    public KnowledgeCatalogInfoResponse.SyncResult syncCatalogToGraph(boolean reloadFirst) {
        if (reloadFirst) {
            catalogStore.reload();
        }
        if (!ready()) {
            return new KnowledgeCatalogInfoResponse.SyncResult(
                    catalogStore.info(),
                    0,
                    false,
                    "图谱服务还没连上：目录已读进系统，但还没法写进图里。"
            );
        }
        int updated = syncExpandedCatalog();
        return new KnowledgeCatalogInfoResponse.SyncResult(
                catalogStore.info(),
                updated,
                true,
                "已把清单写进图谱（共 " + updated + " 个节点）。注意：清单里有的编号，会盖掉你在页面上改过的同名点。"
        );
    }

    /** 同步完整内置目录（大类 + 子知识点 + HAS_CHILD/先修边）。已存在节点会按目录覆盖更新。 */
    public int syncExpandedCatalog() {
        if (!ready()) return 0;
        List<Map<String, Object>> rows = new ArrayList<>();
        for (KnowledgePointResponse point : catalogStore.allNodes()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", point.code());
            row.put("title", point.title());
            row.put("stage", point.stage());
            row.put("stages", point.resolvedStages());
            row.put("difficulty", point.difficulty());
            row.put("categoryCode", point.categoryCode());
            row.put("categoryTitle", point.categoryTitle());
            row.put("kind", point.kind() != null ? point.kind() : "TOPIC");
            rows.add(row);
        }
        List<Map<String, Object>> edgeRows = new ArrayList<>();
        for (KnowledgeEdgeResponse edge : catalogStore.edges()) {
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
                            p.stages = CASE
                              WHEN row.stages IS NOT NULL AND size(row.stages) > 0 THEN row.stages
                              ELSE CASE WHEN row.stage IS NULL THEN [] ELSE [row.stage] END
                            END,
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
            invalidateOverviewCache();
            return rows.size();
        } catch (RuntimeException error) {
            log.warn("同步扩展知识目录失败: {}", error.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "同步知识目录失败: " + error.getMessage(), error);
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
                          AND coalesce(c.published, true) = true
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
            List<Map<String, Object>> published = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Object rawId = row.get("courseId");
                if (!(rawId instanceof Number number)) {
                    continue;
                }
                Course course = courseMapper.selectById(number.longValue());
                if (course == null || !Integer.valueOf(1).equals(course.getStatus())) {
                    continue;
                }
                if (!StringUtils.hasText((String) row.get("courseTitle")) && StringUtils.hasText(course.getTitle())) {
                    row.put("courseTitle", course.getTitle());
                }
                published.add(row);
            }
            return published;
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
            invalidateOverviewCache();
        } catch (RuntimeException error) {
            log.warn("删除章节图节点失败 courseId={}, chapterId={}, err={}",
                    courseId, chapterId, error.getMessage());
        }
    }

    /** 删除整门课程时，清掉该课全部章节图引用。 */
    public void removeCourseChapterRefs(long courseId) {
        if (!ready() || courseId < 1) {
            return;
        }
        try (Session session = open(requireDriver())) {
            session.executeWrite(tx -> {
                tx.run("""
                        MATCH (c:CourseChapterRef)
                        WHERE c.courseId = $courseId
                        DETACH DELETE c
                        """, Values.parameters("courseId", courseId));
                return null;
            });
            invalidateOverviewCache();
        } catch (RuntimeException error) {
            log.warn("删除课程图节点失败 courseId={}, err={}", courseId, error.getMessage());
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
                        MATCH (p:KnowledgePoint {code:$code})-[r:PREREQUISITE_OF|RELATED_TO|HAS_CHILD]-(n:KnowledgePoint)
                        WITH n,
                             type(r) AS relation,
                             CASE WHEN startNode(r)=p THEN 'OUT' ELSE 'IN' END AS direction
                        RETURN DISTINCT n.code AS code, n.title AS title, relation, direction
                        ORDER BY relation, code
                        """, Values.parameters("code", code));
                List<KnowledgeNeighborResponse> rows = new ArrayList<>();
                LinkedHashMap<String, KnowledgeNeighborResponse> unique = new LinkedHashMap<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    String neighborCode = record.get("code").asString();
                    String relation = record.get("relation").asString();
                    String direction = record.get("direction").asString();
                    String key = neighborCode + "|" + relation + "|" + direction;
                    unique.putIfAbsent(key, new KnowledgeNeighborResponse(
                            neighborCode,
                            record.get("title").asString(null),
                            relation,
                            direction
                    ));
                }
                rows.addAll(unique.values());
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
                                StringUtils.hasText(title) ? title : catalogStore.titleForCode(preCode),
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
                                    : catalogStore.titleForCode(preCode);
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
                                    .orElseGet(() -> catalogStore.titleForCode(nextCode)),
                            reason,
                            missingCodes
                    ));
                }
                return rows;
            });
        }
    }

    /** 官方知识点目录是否包含该编码（不依赖 Neo4j 是否已同步）。 */
    public boolean isCatalogCode(String code) {
        return StringUtils.hasText(code) && catalogStore.find(code.trim()) != null;
    }

    /** 校验编码全部在官方目录中；未知编码直接拒绝，避免往图谱里造「野点」。 */
    public void requireCatalogCodes(Collection<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return;
        }
        List<String> unknown = codes.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(code -> catalogStore.find(code) == null)
                .distinct()
                .toList();
        if (!unknown.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "知识点不在官方目录中：" + String.join("、", unknown));
        }
    }

    public void requireCatalogCode(String code) {
        if (!StringUtils.hasText(code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请填写主知识点编码");
        }
        requireCatalogCodes(List.of(code.trim()));
    }

    /**
     * 发布前：每章必须已绑定至少一个目录内知识点。
     * 图谱未启用时跳过（本地可无 Neo4j 发课）；已启用但连不上则拒绝发布，避免未校验就上线。
     */
    public void assertChaptersCoveredForPublish(long courseId, List<CourseChapter> chapters) {
        if (!properties.isEnabled()) {
            return;
        }
        if (!ready()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "知识图谱未就绪，无法校验章节知识点绑定，请稍后重试");
        }
        if (chapters == null || chapters.isEmpty()) {
            return;
        }
        List<String> unbound = new ArrayList<>();
        List<String> invalid = new ArrayList<>();
        for (CourseChapter chapter : chapters) {
            if (chapter == null || chapter.getId() == null) {
                continue;
            }
            String label = StringUtils.hasText(chapter.getTitle()) ? chapter.getTitle() : ("章节#" + chapter.getId());
            List<KnowledgePointResponse> covers = listChapterCovers(courseId, chapter.getId());
            if (covers.isEmpty()) {
                unbound.add(label);
                continue;
            }
            for (KnowledgePointResponse point : covers) {
                if (point == null || !isCatalogCode(point.code())) {
                    invalid.add(label + "→" + (point == null ? "?" : point.code()));
                }
            }
        }
        if (!unbound.isEmpty()) {
            throw new IllegalArgumentException(
                    "以下章节尚未绑定知识点，请先在章节管理中绑定后再发布：" + String.join("、", unbound));
        }
        if (!invalid.isEmpty()) {
            throw new IllegalArgumentException(
                    "以下章节绑定了目录外知识点，请改绑后再发布：" + String.join("、", invalid));
        }
    }

    /** 资料入库成功后：建立 KnowledgeDocumentRef -[:EXPLAINS]-> KnowledgePoint，并写入简介描述。 */
    public void syncDocumentExplains(
            String documentId, String knowledgeCode, String title, String description
    ) {
        if (!ready() || !StringUtils.hasText(documentId) || !StringUtils.hasText(knowledgeCode)) {
            return;
        }
        requireCatalogCode(knowledgeCode);
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
            invalidateOverviewCache();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (RuntimeException error) {
            log.warn("同步资料 EXPLAINS 失败 documentId={}, code={}, err={}",
                    documentId, knowledgeCode, error.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "同步知识图谱失败：" + error.getMessage());
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
            invalidateOverviewCache();
        } catch (RuntimeException error) {
            log.warn("删除资料图节点失败 documentId={}, err={}", documentId, error.getMessage());
        }
    }

    public KnowledgeGraphOverviewResponse overview() {
        return overview(false);
    }

    public KnowledgeGraphOverviewResponse overview(boolean refresh) {
        if (refresh) {
            invalidateOverviewCache();
        } else if (overviewCache != null) {
            try {
                Optional<KnowledgeGraphOverviewResponse> cached = overviewCache.read();
                if (cached.isPresent()) {
                    KnowledgeGraphOverviewResponse sanitized = sanitizeOverviewChapterCovers(cached.get());
                    if (sanitized != cached.get() && overviewCache != null) {
                        try {
                            overviewCache.replace(sanitized);
                        } catch (RuntimeException ignored) {
                            // 下次回源即可
                        }
                    }
                    return sanitized;
                }
            } catch (RuntimeException error) {
                log.warn("知识图谱 overview 缓存读取失败，回源 Neo4j: {}", error.getMessage());
            }
        }
        KnowledgeGraphOverviewResponse response = buildOverview();
        if (overviewCache != null) {
            try {
                overviewCache.replace(response);
            } catch (RuntimeException error) {
                log.warn("知识图谱 overview 缓存写入失败: {}", error.getMessage());
            }
        }
        return response;
    }

    /** 缓存命中时再滤一遍，避免旧缓存把未发布课程带回来。 */
    private KnowledgeGraphOverviewResponse sanitizeOverviewChapterCovers(KnowledgeGraphOverviewResponse overview) {
        if (overview == null) {
            return null;
        }
        List<KnowledgeChapterCoverSummary> filtered = keepPublishedCourseCovers(overview.chapterCovers()).stream()
                .filter(cover -> cover.knowledgeCodes() != null && !cover.knowledgeCodes().isEmpty())
                .toList();
        List<KnowledgeChapterCoverSummary> current = overview.chapterCovers() == null
                ? List.of()
                : overview.chapterCovers();
        if (filtered.size() == current.size() && filtered.equals(current)) {
            return overview;
        }
        KnowledgeGraphOverviewResponse.TeachingLoopStatus loop = overview.teachingLoop();
        boolean hasCovers = !filtered.isEmpty();
        KnowledgeGraphOverviewResponse.TeachingLoopStatus nextLoop = loop == null
                ? null
                : new KnowledgeGraphOverviewResponse.TeachingLoopStatus(
                        loop.graphReady(),
                        loop.hasKnowledgePoints(),
                        loop.hasPrerequisiteEdges(),
                        hasCovers,
                        loop.hasExplains(),
                        loop.summary()
                );
        return new KnowledgeGraphOverviewResponse(
                overview.status(),
                overview.points(),
                overview.edges(),
                filtered,
                overview.explainsCount(),
                nextLoop
        );
    }

    private KnowledgeGraphOverviewResponse buildOverview() {
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
                edges = catalogStore.edges();
            }
        } else {
            edges = catalogStore.edges();
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

    private void invalidateOverviewCache() {
        if (overviewCache == null) {
            return;
        }
        try {
            overviewCache.invalidate();
        } catch (RuntimeException error) {
            log.warn("知识图谱 overview 缓存失效失败: {}", error.getMessage());
        }
    }

    public List<KnowledgeEdgeResponse> listEdges() {
        if (!ready()) return catalogStore.edges();
        try (Session session = open(requireDriver())) {
            return session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (a:KnowledgePoint)-[r:PREREQUISITE_OF|RELATED_TO|HAS_CHILD]->(b:KnowledgePoint)
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
            return catalogStore.edges();
        }
    }

    public List<KnowledgeChapterCoverSummary> listChapterCoverSummaries() {
        if (!ready()) return List.of();
        try (Session session = open(requireDriver())) {
            List<KnowledgeChapterCoverSummary> rows = session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (c:CourseChapterRef)
                        WHERE coalesce(c.courseId, 0) > 0
                          AND coalesce(c.published, true) = true
                        OPTIONAL MATCH (c)-[:COVERS]->(p:KnowledgePoint)
                        RETURN c.courseId AS courseId, c.chapterId AS chapterId,
                               c.courseTitle AS courseTitle,
                               c.title AS title, c.description AS description,
                               collect(p.code) AS codes
                        ORDER BY courseId, chapterId
                        """);
                List<KnowledgeChapterCoverSummary> list = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    if (record.get("courseId").isNull() || record.get("chapterId").isNull()) continue;
                    List<String> codes = record.get("codes").isNull()
                            ? List.of()
                            : record.get("codes").asList(value -> value.isNull() ? null : value.asString())
                            .stream().filter(StringUtils::hasText).toList();
                    list.add(new KnowledgeChapterCoverSummary(
                            record.get("courseId").asLong(),
                            record.get("chapterId").asLong(),
                            record.get("courseTitle").asString(null),
                            record.get("title").asString(null),
                            record.get("description").asString(null),
                            codes
                    ));
                }
                return list;
            });
            // 只保留「已发布课程 + 确实有绑定」的章节
            return keepPublishedCourseCovers(rows).stream()
                    .filter(cover -> cover.knowledgeCodes() != null && !cover.knowledgeCodes().isEmpty())
                    .toList();
        } catch (RuntimeException error) {
            log.warn("读取章节覆盖失败: {}", error.getMessage());
            return List.of();
        }
    }

    /** overview / 管理端「已绑章节」只展示已发布课程，避免草稿课混进审查列表。 */
    private List<KnowledgeChapterCoverSummary> keepPublishedCourseCovers(List<KnowledgeChapterCoverSummary> covers) {
        if (covers == null || covers.isEmpty()) {
            return List.of();
        }
        Set<Long> courseIds = covers.stream()
                .map(KnowledgeChapterCoverSummary::courseId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (courseIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Course> publishedById = courseMapper.selectList(Wrappers.lambdaQuery(Course.class)
                        .in(Course::getId, courseIds)
                        .eq(Course::getStatus, 1))
                .stream()
                .collect(Collectors.toMap(Course::getId, course -> course, (a, b) -> a, LinkedHashMap::new));
        if (publishedById.isEmpty()) {
            return List.of();
        }
        List<KnowledgeChapterCoverSummary> published = new ArrayList<>();
        for (KnowledgeChapterCoverSummary cover : covers) {
            Course course = publishedById.get(cover.courseId());
            if (course == null) {
                continue;
            }
            String courseTitle = StringUtils.hasText(course.getTitle())
                    ? course.getTitle()
                    : cover.courseTitle();
            published.add(new KnowledgeChapterCoverSummary(
                    cover.courseId(),
                    cover.chapterId(),
                    courseTitle,
                    cover.title(),
                    cover.description(),
                    cover.knowledgeCodes()
            ));
        }
        return published;
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
                    // 节点可覆盖多个学段；讲解难度/用语由学习者档案 schoolStage 决定，勿仅看图谱学段。
                    payload.put("focusStages", point.resolvedStages());
                    payload.put("focusStage", point.stage());
                    payload.put("stageResolution", "learner_profile");
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
        for (String code : catalogStore.relatedExplainCodes(focusCode)) {
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
        for (String code : catalogStore.relatedExplainCodes(focusCode)) {
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

    /** 某知识点下的讲解资料（GraphRAG 候选入口）；仅返回仍有效的已入库资料。 */
    public List<Map<String, Object>> listExplains(String knowledgeCode) {
        if (!ready() || !StringUtils.hasText(knowledgeCode)) return List.of();
        try (Session session = open(requireDriver())) {
            List<Map<String, Object>> rows = session.executeRead(tx -> {
                Result result = tx.run("""
                        MATCH (d:KnowledgeDocumentRef)-[:EXPLAINS]->(p:KnowledgePoint {code:$code})
                        RETURN d.documentId AS documentId, d.title AS title, d.description AS description
                        ORDER BY d.updatedAt DESC
                        LIMIT 40
                        """, Values.parameters("code", knowledgeCode.trim()));
                List<Map<String, Object>> list = new ArrayList<>();
                while (result.hasNext()) {
                    Record record = result.next();
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("documentId", record.get("documentId").asString(null));
                    row.put("title", record.get("title").asString(null));
                    row.put("description", record.get("description").asString(null));
                    list.add(row);
                }
                return list;
            });
            return keepLiveExplainDocuments(rows);
        } catch (RuntimeException error) {
            log.warn("读取 EXPLAINS 失败 code={}, err={}", knowledgeCode, error.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> keepLiveExplainDocuments(List<Map<String, Object>> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> live = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String documentId = row.get("documentId") == null ? null : String.valueOf(row.get("documentId"));
            if (!StringUtils.hasText(documentId)) {
                continue;
            }
            if (documentId.startsWith("formal-demo-")) {
                live.add(row);
                if (live.size() >= 20) break;
                continue;
            }
            if (!documentId.startsWith("teaching-resource-")) {
                continue;
            }
            Long resourceId = parseTeachingResourceId(documentId);
            if (resourceId == null) {
                continue;
            }
            TeachingResource resource = teachingResourceMapper.selectById(resourceId);
            if (resource == null
                    || !"PUBLISHED".equals(resource.getStatus())
                    || !"INDEXED".equals(resource.getRagIndexStatus())) {
                continue;
            }
            live.add(row);
            if (live.size() >= 20) break;
        }
        return live;
    }

    private Long parseTeachingResourceId(String documentId) {
        if (!StringUtils.hasText(documentId) || !documentId.startsWith("teaching-resource-")) {
            return null;
        }
        try {
            return Long.parseLong(documentId.substring("teaching-resource-".length()));
        } catch (NumberFormatException ignored) {
            return null;
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
            try {
                syncExpandedCatalog();
            } catch (RuntimeException syncError) {
                log.warn("启动时同步知识目录失败（Cypher 种子已执行）: {}", syncError.getMessage());
            }
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
            // 1) 基础数据：约束、少量示例点、示例章节/资料绑定，让闭环能先跑起来
            runClasspathCypher(driver, "neo4j/001_constraints.cypher");
            runClasspathCypher(driver, "neo4j/002_seed_ai_literacy.cypher");
            runClasspathCypher(driver, "neo4j/003_seed_demo_teaching_loop.cypher");
            runClasspathCypher(driver, "neo4j/004_cleanup_formal_demo_docs.cypher");
            // 2) 重新读最新清单，再整份写进图（会盖掉上面基础脚本里同编号的属性）
            catalogStore.reload();
            syncExpandedCatalog();
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "读取 Cypher 失败", error);
        }
        invalidateOverviewCache();
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

    private KnowledgePointResponse toPoint(Record record) {
        Integer difficulty = record.get("difficulty").isNull() ? null : record.get("difficulty").asInt();
        String code = record.get("code").asString();
        String categoryCode = optionalString(record, "categoryCode");
        String categoryTitle = optionalString(record, "categoryTitle");
        String kind = optionalString(record, "kind");
        String stage = record.keys().contains("stage") && !record.get("stage").isNull()
                ? record.get("stage").asString(null)
                : null;
        List<String> stages = readStringList(record, "stages");
        KnowledgePointResponse builtin = catalogStore.find(code);
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
            if (stages.isEmpty() && !StringUtils.hasText(stage)) {
                stages = builtin.resolvedStages();
                stage = builtin.stage();
            }
        }
        return new KnowledgePointResponse(
                code,
                record.get("title").asString(null),
                stage,
                difficulty,
                record.get("reviewStatus").asString(null),
                categoryCode,
                categoryTitle,
                kind != null ? kind : "TOPIC",
                stages.isEmpty() ? null : stages
        );
    }

    private static List<String> readStringList(Record record, String key) {
        if (!record.keys().contains(key) || record.get(key).isNull()) {
            return List.of();
        }
        try {
            return record.get(key).asList(value -> {
                if (value == null || value.isNull()) {
                    return null;
                }
                String text = value.asString(null);
                return StringUtils.hasText(text) ? text.trim() : null;
            }).stream().filter(StringUtils::hasText).distinct().toList();
        } catch (RuntimeException ignored) {
            return List.of();
        }
    }

    private static String optionalString(Record record, String key) {
        if (!record.keys().contains(key) || record.get(key).isNull()) {
            return null;
        }
        return record.get(key).asString(null);
    }
}
