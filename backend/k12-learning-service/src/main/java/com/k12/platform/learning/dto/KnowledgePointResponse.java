package com.k12.platform.learning.dto;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

public record KnowledgePointResponse(
        String code,
        String title,
        /** 展示用：多个学段用顿号拼接；与 {@link #stages} 同步。 */
        String stage,
        Integer difficulty,
        String reviewStatus,
        String categoryCode,
        String categoryTitle,
        String kind,
        /** 适用学段列表（可多选）；旧数据可能只有 stage 字符串。 */
        List<String> stages
) {
    public KnowledgePointResponse {
        List<String> resolved = normalizeStages(stages, stage);
        stages = resolved;
        if ((stage == null || stage.isBlank()) && !resolved.isEmpty()) {
            stage = joinStages(resolved);
        }
    }

    /** 兼容旧调用：无分类 / stages 字段。 */
    public KnowledgePointResponse(
            String code, String title, String stage, Integer difficulty, String reviewStatus
    ) {
        this(code, title, stage, difficulty, reviewStatus, null, null, "TOPIC", null);
    }

    /** 兼容旧调用：无 stages 列表。 */
    public KnowledgePointResponse(
            String code,
            String title,
            String stage,
            Integer difficulty,
            String reviewStatus,
            String categoryCode,
            String categoryTitle,
            String kind
    ) {
        this(code, title, stage, difficulty, reviewStatus, categoryCode, categoryTitle, kind, null);
    }

    public List<String> resolvedStages() {
        return stages == null || stages.isEmpty() ? List.of() : stages;
    }

    public static List<String> normalizeStages(List<String> stages, String stage) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        if (stages != null) {
            for (String item : stages) {
                if (item != null && !item.isBlank()) {
                    set.add(item.trim());
                }
            }
        }
        if (set.isEmpty()) {
            set.addAll(splitStages(stage));
        }
        return List.copyOf(set);
    }

    public static List<String> splitStages(String stage) {
        if (stage == null || stage.isBlank()) {
            return List.of();
        }
        return Arrays.stream(stage.split("[、,/|;；]+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    public static String joinStages(List<String> stages) {
        if (stages == null || stages.isEmpty()) {
            return null;
        }
        return String.join("、", stages);
    }

    public boolean matchesStageFilter(String stageFilter) {
        if (stageFilter == null || stageFilter.isBlank()) {
            return true;
        }
        String needle = stageFilter.trim();
        for (String item : resolvedStages()) {
            if (stageLabelsMatch(item, needle)) {
                return true;
            }
        }
        return stage != null && stageLabelsMatch(stage, needle);
    }

    /** 中文学段标签与目录英文编码互通，便于筛选。 */
    static boolean stageLabelsMatch(String left, String right) {
        if (left == null || right == null) {
            return false;
        }
        String a = left.trim();
        String b = right.trim();
        if (a.isEmpty() || b.isEmpty()) {
            return false;
        }
        if (a.equalsIgnoreCase(b) || a.contains(b) || b.contains(a)) {
            return true;
        }
        return stageCanonical(a).equals(stageCanonical(b));
    }

    static String stageCanonical(String raw) {
        String value = raw.trim().toUpperCase();
        return switch (value) {
            case "小学低年级", "PRIMARY_LOWER", "LOW_PRIMARY", "LOWER_PRIMARY" -> "PRIMARY_LOWER";
            case "小学高年级", "PRIMARY_UPPER", "HIGH_PRIMARY", "UPPER_PRIMARY" -> "PRIMARY_UPPER";
            case "初中", "JUNIOR_HIGH", "MIDDLE_SCHOOL" -> "JUNIOR_HIGH";
            case "高中", "SENIOR_HIGH", "HIGH_SCHOOL" -> "SENIOR_HIGH";
            default -> value;
        };
    }
}
