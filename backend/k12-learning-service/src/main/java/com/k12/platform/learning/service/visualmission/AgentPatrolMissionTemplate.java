package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class AgentPatrolMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.AGENT_PATROL;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "k12_train_classifier", "k12_predict_image",
                "controls_if", "k12_prediction_equals", "k12_confidence_at_least",
                "controls_repeat_ext", "k12_move", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "ai", "logic", "control", "motion", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("imageId", "expectedCategory", "minRepeatTimes", "maxRepeatTimes",
                "minDistance", "messageKeyword");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireImageId(config);
        requireCategory(config, "expectedCategory", "期望类别");
        requireIntRange(config, "minRepeatTimes", 1, 10, "最小循环次数");
        requireIntRange(config, "maxRepeatTimes", 1, 10, "最大循环次数");
        if (config.get("minRepeatTimes").asInt() > config.get("maxRepeatTimes").asInt()) {
            throw new IllegalArgumentException("最小循环次数不能大于最大循环次数");
        }
        requireIntRange(config, "minDistance", 1, 100, "最小距离");
        requireKeyword(config);
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "imageId", "expectedCategory", "minRepeatTimes",
                "maxRepeatTimes", "minDistance", "messageKeyword");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        int trainIndex = firstIndex(blocks, "k12_train_classifier");
        int predictIndex = firstIndex(blocks, "k12_predict_image");
        String imageId = config.path("imageId").asText();
        String expectedCategory = config.path("expectedCategory").asText();
        boolean predictsTarget = predictIndex > trainIndex && predictIndex >= 0
                && imageId.equals(field(blocks.get(predictIndex), "IMAGE"));
        JsonNode conditionBlock = blocks.stream().filter(block -> type(block).equals("controls_if"))
                .findFirst().orElse(null);
        JsonNode predicate = inputBlock(conditionBlock, "IF0");
        boolean checksCategory = predicate != null && type(predicate).equals("k12_prediction_equals")
                && expectedCategory.equals(field(predicate, "CATEGORY"));
        JsonNode body = inputBlock(conditionBlock, "DO0");
        List<JsonNode> bodyBlocks = flatten(body == null ? List.of() : List.of(body));
        JsonNode repeat = bodyBlocks.stream().filter(block -> type(block).equals("controls_repeat_ext"))
                .findFirst().orElse(null);
        int times = numberField(inputBlock(repeat, "TIMES"), "NUM", 0);
        JsonNode repeatedBody = inputBlock(repeat, "DO");
        int bodyDistance = flatten(repeatedBody == null ? List.of() : List.of(repeatedBody)).stream()
                .filter(block -> type(block).equals("k12_move"))
                .mapToInt(block -> numberField(block, "STEPS", 0)).sum();
        int minTimes = config.path("minRepeatTimes").asInt(2);
        int maxTimes = config.path("maxRepeatTimes").asInt(10);
        int minDistance = config.path("minDistance").asInt(8);
        String keyword = config.path("messageKeyword").asText("巡检完成");
        boolean reportsDone = bodyBlocks.stream()
                .anyMatch(block -> type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("sense", "识别目标图片", predictsTarget),
                check("decide", "判断结果并使用循环",
                        checksCategory && times >= minTimes && times <= maxTimes),
                check("act", "前进至少 " + minDistance + " 步并报告完成",
                        times * bodyDistance >= minDistance && reportsDone)
        ));
    }
}
