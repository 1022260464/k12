package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class ConfidenceGateMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.CONFIDENCE_GATE;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "k12_train_classifier", "k12_predict_image",
                "controls_if", "k12_prediction_equals", "k12_confidence_at_least", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "ai", "logic", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("imageId", "predictionCategory", "simulatedConfidence",
                "minimumThreshold", "messageKeyword");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireImageId(config);
        requireCategory(config, "predictionCategory", "预测类别");
        requireIntRange(config, "simulatedConfidence", 50, 100, "模拟置信度");
        requireIntRange(config, "minimumThreshold", 50, 100, "最小阈值");
        requireKeyword(config);
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "imageId", "predictionCategory", "simulatedConfidence", "minimumThreshold");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        int trainIndex = firstIndex(blocks, "k12_train_classifier");
        int predictIndex = firstIndex(blocks, "k12_predict_image");
        JsonNode conditionBlock = blocks.stream().filter(block -> type(block).equals("controls_if"))
                .findFirst().orElse(null);
        JsonNode predicate = inputBlock(conditionBlock, "IF0");
        int threshold = numberField(predicate, "THRESHOLD", 0);
        JsonNode response = inputBlock(conditionBlock, "DO0");
        int minimumThreshold = config.path("minimumThreshold").asInt(80);
        String keyword = config.path("messageKeyword").asText("很有把握");
        boolean saysConfident = flatten(response == null ? List.of() : List.of(response)).stream()
                .anyMatch(block -> type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("predict", "训练后完成一次预测", trainIndex >= 0 && predictIndex > trainIndex),
                check("threshold", "设置至少 " + minimumThreshold + "% 的置信度门槛",
                        predicate != null && type(predicate).equals("k12_confidence_at_least")
                                && threshold >= minimumThreshold),
                check("answer", "条件成立后说出有把握的话", saysConfident)
        ));
    }
}
