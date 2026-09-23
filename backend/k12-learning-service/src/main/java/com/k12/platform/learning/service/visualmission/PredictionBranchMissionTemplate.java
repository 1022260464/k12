package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class PredictionBranchMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.PREDICTION_BRANCH;
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
        return Set.of("imageId", "expectedCategory", "messageKeyword", "requireTrain");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireImageId(config);
        requireCategory(config, "expectedCategory", "期望类别");
        requireKeyword(config);
        requireBoolean(config, "requireTrain", "requireTrain");
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "imageId", "expectedCategory", "requireTrain");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        int trainIndex = firstIndex(blocks, "k12_train_classifier");
        int predictIndex = firstIndex(blocks, "k12_predict_image");
        JsonNode conditionBlock = blocks.stream().filter(block -> type(block).equals("controls_if")).findFirst().orElse(null);
        JsonNode predicate = inputBlock(conditionBlock, "IF0");
        JsonNode response = inputBlock(conditionBlock, "DO0");
        String imageId = config.path("imageId").asText();
        String expectedCategory = config.path("expectedCategory").asText();
        String keyword = config.path("messageKeyword").asText();
        boolean requireTrain = config.path("requireTrain").asBoolean(true);
        boolean trained = !requireTrain || trainIndex >= 0;
        boolean predictedMystery = predictIndex >= 0
                && (!requireTrain || predictIndex > trainIndex)
                && imageId.equals(field(blocks.get(predictIndex), "IMAGE"));
        boolean conditionMatches = predicate != null && type(predicate).equals("k12_prediction_equals")
                && expectedCategory.equals(field(predicate, "CATEGORY"));
        boolean saysAnswer = flatten(response == null ? List.of() : List.of(response)).stream()
                .anyMatch(block -> type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("train", "先训练分类器", trained),
                check("predict", "训练后预测目标图片", predictedMystery),
                check("condition", "用条件判断并说出答案", conditionMatches && saysAnswer)
        ));
    }
}
