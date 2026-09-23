package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 通过比较各类别样本数量，理解数据偏差、公平性和负责任 AI。 */
@Component
public class DataBalanceMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.DATA_BALANCE;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "k12_label_image", "k12_check_balance", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "data", "fairness", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("requiredClasses", "minSamplesPerClass", "maxDifference", "messageKeyword");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireStringArray(config, "requiredClasses", 2, 4, safeCategory(), "必需类别");
        requireIntRange(config, "minSamplesPerClass", 1, 6, "每类最少样本数");
        requireIntRange(config, "maxDifference", 0, 6, "类别最大数量差");
        requireKeyword(config);
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "requiredClasses", "minSamplesPerClass", "maxDifference", "messageKeyword");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        Map<String, String> labels = new HashMap<>();
        blocks.stream().filter(block -> type(block).equals("k12_label_image")).forEach(block ->
                labels.put(field(block, "IMAGE"), field(block, "CATEGORY")));
        Map<String, Integer> counts = new HashMap<>();
        labels.values().forEach(category -> counts.merge(category, 1, Integer::sum));

        int minSamples = config.path("minSamplesPerClass").asInt(2);
        int maxDifference = config.path("maxDifference").asInt(0);
        int minimum = Integer.MAX_VALUE;
        int maximum = Integer.MIN_VALUE;
        boolean enoughSamples = true;
        for (JsonNode requiredClass : config.path("requiredClasses")) {
            int count = counts.getOrDefault(requiredClass.asText(), 0);
            minimum = Math.min(minimum, count);
            maximum = Math.max(maximum, count);
            enoughSamples &= count >= minSamples;
        }

        boolean checkedBalance = blocks.stream().anyMatch(block -> type(block).equals("k12_check_balance"));
        String keyword = config.path("messageKeyword").asText("数据要均衡");
        boolean explainsFairness = blocks.stream().anyMatch(block ->
                type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("samples", "每个类别至少有 " + minSamples + " 个样本", enoughSamples),
                check("balance", "检查数据且类别数量差不超过 " + maxDifference,
                        checkedBalance && maximum - minimum <= maxDifference),
                check("fairness", "说明数据均衡与公平性", explainsFairness)
        ));
    }
}
