package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class DataLabelingMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.DATA_LABELING;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "k12_label_image", "k12_train_classifier",
                "k12_predict_image", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "data", "ai", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("expectedLabels", "requiredClasses", "requireTrain");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        JsonNode labels = config.get("expectedLabels");
        if (labels == null || !labels.isObject() || labels.size() < 1 || labels.size() > 12) {
            throw new IllegalArgumentException("期望标签数量不合法");
        }
        Iterator<Map.Entry<String, JsonNode>> fields = labels.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            if (!safeId().matcher(entry.getKey()).matches()) {
                throw new IllegalArgumentException("标签图片 ID 格式不正确");
            }
            if (!entry.getValue().isTextual() || !safeCategory().matcher(entry.getValue().asText()).matches()) {
                throw new IllegalArgumentException("标签类别格式不正确");
            }
        }
        requireStringArray(config, "requiredClasses", 1, 6, safeCategory(), "必需类别");
        requireBoolean(config, "requireTrain", "requireTrain");
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "expectedLabels", "requiredClasses", "requireTrain");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> program = connectedProgram(workspace);
        Map<String, String> labels = new HashMap<>();
        flatten(program).stream().filter(block -> type(block).equals("k12_label_image")).forEach(block ->
                labels.put(field(block, "IMAGE"), field(block, "CATEGORY")));
        JsonNode expected = config.path("expectedLabels");
        long correct = 0;
        long total = 0;
        Iterator<Map.Entry<String, JsonNode>> fields = expected.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            total++;
            if (entry.getValue().asText().equals(labels.get(entry.getKey()))) correct++;
        }
        boolean classesOk = true;
        for (JsonNode required : config.path("requiredClasses")) {
            if (!labels.containsValue(required.asText())) {
                classesOk = false;
                break;
            }
        }
        boolean trained = !config.path("requireTrain").asBoolean(true)
                || flatten(program).stream().anyMatch(block -> type(block).equals("k12_train_classifier"));
        return result(List.of(
                check("labels", total + " 张图片的标签全部正确", correct == total && total > 0),
                check("classes", "训练数据覆盖必需类别", classesOk),
                check("train", "完成分类器训练", trained && classesOk)
        ));
    }
}
