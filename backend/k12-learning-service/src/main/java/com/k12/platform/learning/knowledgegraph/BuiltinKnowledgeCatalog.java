package com.k12.platform.learning.knowledgegraph;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.dto.KnowledgeEdgeResponse;
import com.k12.platform.learning.dto.KnowledgePointResponse;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 与种子图一致的内置目录：从 classpath JSON 加载大类 + 知识点。
 * Neo4j 未启用或为空时，管理端仍可勾选展示；真正写入 COVERS 仍需要 Neo4j。
 */
public final class BuiltinKnowledgeCatalog {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<KnowledgePointResponse> CATEGORIES;
    private static final List<KnowledgePointResponse> TOPICS;
    private static final List<KnowledgePointResponse> ALL;
    private static final List<KnowledgeEdgeResponse> EDGES;
    private static final Map<String, KnowledgePointResponse> BY_CODE;

    static {
        try {
            Loaded loaded = loadClasspath();
            CATEGORIES = List.copyOf(loaded.categories());
            TOPICS = List.copyOf(loaded.topics());
            ALL = List.copyOf(loaded.all());
            EDGES = List.copyOf(loaded.edges());
            Map<String, KnowledgePointResponse> index = new LinkedHashMap<>();
            for (KnowledgePointResponse point : ALL) {
                index.put(point.code(), point);
            }
            BY_CODE = Map.copyOf(index);
        } catch (IOException error) {
            throw new ExceptionInInitializerError(error);
        }
    }

    private BuiltinKnowledgeCatalog() {
    }

    public static List<KnowledgePointResponse> all() {
        return TOPICS;
    }

    /** 含大类节点 + 知识点，供种子同步与全量目录。 */
    public static List<KnowledgePointResponse> allNodes() {
        return ALL;
    }

    public static List<KnowledgePointResponse> categories() {
        return CATEGORIES;
    }

    public static KnowledgePointResponse find(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return BY_CODE.get(code.trim());
    }

    /** 学生可见标题：优先目录中文名，避免把编码透出到文案。 */
    public static String titleForCode(String code) {
        KnowledgePointResponse point = find(code);
        if (point != null && point.title() != null && !point.title().isBlank()) {
            return point.title();
        }
        return code == null ? "" : code.trim();
    }

    /** 同主题簇：讲解资料常挂在兄弟知识点上（如提示词讲义也覆盖幻觉）。 */
    public static List<String> relatedExplainCodes(String focusCode) {
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
                List<String> siblings = TOPICS.stream()
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

    public static List<KnowledgeEdgeResponse> seedEdges() {
        return EDGES;
    }

    public static List<KnowledgePointResponse> filter(String query, String stage, int limit) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String stageFilter = stage == null ? "" : stage.trim();
        int capped = Math.min(Math.max(limit, 1), 500);
        return TOPICS.stream()
                .filter(point -> stageFilter.isEmpty() || stageFilter.equalsIgnoreCase(point.stage()))
                .filter(point -> q.isEmpty()
                        || (point.code() != null && point.code().toLowerCase(Locale.ROOT).contains(q))
                        || (point.title() != null && point.title().toLowerCase(Locale.ROOT).contains(q))
                        || (point.categoryTitle() != null
                        && point.categoryTitle().toLowerCase(Locale.ROOT).contains(q)))
                .limit(capped)
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private static Loaded loadClasspath() throws IOException {
        ClassPathResource resource = new ClassPathResource("knowledge/ai_literacy_catalog.json");
        if (!resource.exists()) {
            throw new IOException("缺少 knowledge/ai_literacy_catalog.json");
        }
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = MAPPER.readTree(in);
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
            return new Loaded(categories, topics, all, edges);
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
        return new KnowledgePointResponse(
                text(node, "code"),
                text(node, "title"),
                text(node, "stage"),
                difficulty,
                "APPROVED",
                categoryCode,
                categoryTitle,
                kind
        );
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asText();
        return text == null || text.isBlank() ? null : text.trim();
    }

    private record Loaded(
            List<KnowledgePointResponse> categories,
            List<KnowledgePointResponse> topics,
            List<KnowledgePointResponse> all,
            List<KnowledgeEdgeResponse> edges
    ) {
    }
}
