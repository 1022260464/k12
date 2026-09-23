package com.k12.platform.learning.knowledgegraph;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.config.KnowledgeCatalogProperties;
import com.k12.platform.learning.dto.KnowledgeCatalogInfoResponse;
import com.k12.platform.learning.dto.KnowledgeEdgeResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * 可热加载的知识目录（单一运行时真相源）。
 * <p>默认读 classpath {@code knowledge/ai_literacy_catalog.json}；
 * 可通过配置改为外部文件，管理端「重新读清单」无需重启 JVM。
 */
@Component
public class KnowledgeCatalogStore {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeCatalogStore.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final KnowledgeCatalogProperties properties;
    private final ResourceLoader resourceLoader;
    private final AtomicReference<Snapshot> snapshot = new AtomicReference<>();

    public KnowledgeCatalogStore(KnowledgeCatalogProperties properties, ResourceLoader resourceLoader) {
        this.properties = properties;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    void init() {
        reload();
        BuiltinKnowledgeCatalog.bind(this);
    }

    /** 从配置的 Resource 重新读入内存；成功后旧快照被替换。 */
    public synchronized KnowledgeCatalogInfoResponse reload() {
        String location = StringUtils.hasText(properties.getLocation())
                ? properties.getLocation().trim()
                : "classpath:knowledge/ai_literacy_catalog.json";
        Resource resource = resourceLoader.getResource(location);
        if (!resource.exists()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "知识目录不存在: " + location);
        }
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = MAPPER.readTree(in);
            int version = root.path("version").asInt(0);
            List<KnowledgePointResponse> categories = new ArrayList<>();
            List<KnowledgePointResponse> topics = new ArrayList<>();
            List<KnowledgePointResponse> all = new ArrayList<>();
            List<KnowledgeEdgeResponse> edges = new ArrayList<>();

            for (JsonNode node : root.path("categories")) {
                KnowledgePointResponse point = nodeToPoint(node, "CATEGORY", null, null);
                categories.add(point);
                all.add(point);
            }
            for (JsonNode node : root.path("points")) {
                KnowledgePointResponse point = nodeToPoint(
                        node,
                        "TOPIC",
                        text(node, "categoryCode"),
                        text(node, "categoryTitle")
                );
                topics.add(point);
                all.add(point);
            }
            for (JsonNode node : root.path("edges")) {
                edges.add(new KnowledgeEdgeResponse(
                        text(node, "from"),
                        text(node, "to"),
                        text(node, "relation")
                ));
            }
            if (topics.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "知识目录无知识点: " + location);
            }

            Map<String, KnowledgePointResponse> byCode = new LinkedHashMap<>();
            for (KnowledgePointResponse point : all) {
                if (point.code() != null) {
                    byCode.put(point.code(), point);
                }
            }
            String resolved = resolveSourceLabel(resource, location);
            Snapshot next = new Snapshot(
                    location,
                    resolved,
                    version,
                    Instant.now(),
                    List.copyOf(categories),
                    List.copyOf(topics),
                    List.copyOf(all),
                    List.copyOf(edges),
                    Map.copyOf(byCode)
            );
            snapshot.set(next);
            log.info("知识目录已加载 source={}, version={}, categories={}, topics={}, edges={}",
                    resolved, version, categories.size(), topics.size(), edges.size());
            return info();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "读取知识目录失败: " + location, error);
        }
    }

    public KnowledgeCatalogInfoResponse info() {
        Snapshot current = require();
        return new KnowledgeCatalogInfoResponse(
                current.location(),
                current.resolvedSource(),
                current.version(),
                current.loadedAt(),
                current.categories().size(),
                current.topics().size(),
                current.edges().size(),
                "知识点清单来自一份 JSON 文件。改完先点「重新读清单」，再点「写进图谱」，图上才会更新。"
        );
    }

    public List<KnowledgePointResponse> topics() {
        return require().topics();
    }

    public List<KnowledgePointResponse> categories() {
        return require().categories();
    }

    public List<KnowledgePointResponse> allNodes() {
        return require().all();
    }

    public List<KnowledgeEdgeResponse> edges() {
        return require().edges();
    }

    public KnowledgePointResponse find(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return require().byCode().get(code.trim());
    }

    public String titleForCode(String code) {
        KnowledgePointResponse point = find(code);
        if (point != null && point.title() != null && !point.title().isBlank()) {
            return point.title();
        }
        return code == null ? "" : code.trim();
    }

    public List<String> relatedExplainCodes(String focusCode) {
        if (focusCode == null || focusCode.isBlank()) {
            return List.of();
        }
        String code = focusCode.trim();
        return switch (code) {
            case "generative_ai.hallucination" -> List.of(
                    "generative_ai.hallucination",
                    "generative_ai.prompt_basics",
                    "generative_ai.responsible_use",
                    "generative_ai.llm_basics"
            );
            case "generative_ai.prompt_basics" -> List.of(
                    "generative_ai.prompt_basics",
                    "generative_ai.hallucination",
                    "generative_ai.responsible_use",
                    "generative_ai.llm_basics"
            );
            case "generative_ai.responsible_use" -> List.of(
                    "generative_ai.responsible_use",
                    "generative_ai.prompt_basics",
                    "generative_ai.hallucination"
            );
            default -> {
                KnowledgePointResponse point = find(code);
                if (point == null || point.categoryCode() == null) {
                    yield List.of(code);
                }
                List<String> siblings = topics().stream()
                        .filter(item -> point.categoryCode().equals(item.categoryCode()))
                        .map(KnowledgePointResponse::code)
                        .limit(8)
                        .collect(Collectors.toCollection(ArrayList::new));
                if (!siblings.contains(code)) {
                    siblings.add(0, code);
                }
                yield List.copyOf(siblings);
            }
        };
    }

    public List<KnowledgePointResponse> filter(String query, String stage, int limit) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String stageFilter = stage == null ? "" : stage.trim();
        int capped = Math.min(Math.max(limit, 1), 500);
        return topics().stream()
                .filter(point -> point.matchesStageFilter(stageFilter))
                .filter(point -> q.isEmpty()
                        || (point.code() != null && point.code().toLowerCase(Locale.ROOT).contains(q))
                        || (point.title() != null && point.title().toLowerCase(Locale.ROOT).contains(q))
                        || point.aliases().stream().anyMatch(item -> item.toLowerCase(Locale.ROOT).contains(q))
                        || point.keywords().stream().anyMatch(item -> item.toLowerCase(Locale.ROOT).contains(q))
                        || (point.categoryTitle() != null
                        && point.categoryTitle().toLowerCase(Locale.ROOT).contains(q)))
                .limit(capped)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private Snapshot require() {
        Snapshot current = snapshot.get();
        if (current == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "知识目录尚未加载");
        }
        return current;
    }

    private static String resolveSourceLabel(Resource resource, String location) {
        try {
            if (resource.isFile()) {
                return resource.getFile().getAbsolutePath();
            }
        } catch (IOException ignored) {
            // classpath 等不可解析为 File 时退回 location
        }
        try {
            return resource.getURI().toString();
        } catch (IOException ignored) {
            return location;
        }
    }

    private static KnowledgePointResponse nodeToPoint(
            JsonNode node, String defaultKind, String categoryCode, String categoryTitle
    ) {
        String kind = text(node, "kind");
        if (kind == null || kind.isBlank()) {
            kind = defaultKind;
        }
        Integer difficulty = node.hasNonNull("difficulty") ? node.get("difficulty").asInt() : null;
        List<String> stages = new ArrayList<>();
        if (node.has("stages") && node.get("stages").isArray()) {
            for (JsonNode item : node.get("stages")) {
                if (item != null && item.isTextual() && !item.asText().isBlank()) {
                    stages.add(item.asText().trim());
                }
            }
        }
        List<String> aliases = stringList(node, "aliases");
        List<String> keywords = stringList(node, "keywords");
        return new KnowledgePointResponse(
                text(node, "code"),
                text(node, "title"),
                text(node, "stage"),
                difficulty,
                "APPROVED",
                categoryCode,
                categoryTitle,
                kind,
                stages.isEmpty() ? null : stages,
                aliases,
                keywords
        );
    }

    private static List<String> stringList(JsonNode node, String field) {
        List<String> values = new ArrayList<>();
        JsonNode array = node.get(field);
        if (array != null && array.isArray()) {
            for (JsonNode item : array) {
                if (item != null && item.isTextual() && !item.asText().isBlank()) {
                    values.add(item.asText().trim());
                }
            }
        }
        return List.copyOf(values);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.isBlank() ? null : text.trim();
    }

    private record Snapshot(
            String location,
            String resolvedSource,
            int version,
            Instant loadedAt,
            List<KnowledgePointResponse> categories,
            List<KnowledgePointResponse> topics,
            List<KnowledgePointResponse> all,
            List<KnowledgeEdgeResponse> edges,
            Map<String, KnowledgePointResponse> byCode
    ) {
    }
}
