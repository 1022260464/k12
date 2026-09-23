package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 游戏化选择题模板：答题、计分并提交结果。 */
@Component
public class QuizGameMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.QUIZ_GAME;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of("k12_when_start", "k12_quiz_answer", "k12_submit_quiz"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "game");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("expectedAnswers", "passScore");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireStringArray(config, "expectedAnswers", 3, 3, safeCategory(), "标准答案");
        requireIntRange(config, "passScore", 1, 3, "通关分数");
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "expectedAnswers", "passScore");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        Map<String, String> answers = new HashMap<>();
        blocks.stream().filter(block -> type(block).equals("k12_quiz_answer")).forEach(block ->
                answers.put(field(block, "QUESTION"), field(block, "ANSWER")));

        int correct = 0;
        for (int index = 0; index < config.path("expectedAnswers").size(); index++) {
            String expected = config.path("expectedAnswers").get(index).asText();
            if (expected.equals(answers.get("q" + (index + 1)))) correct++;
        }
        int passScore = config.path("passScore").asInt(3);
        boolean submitted = blocks.stream().anyMatch(block -> type(block).equals("k12_submit_quiz"));
        return result(List.of(
                check("answered", "完成全部 3 道题", answers.size() == 3),
                check("score", "答对至少 " + passScore + " 道题", correct >= passScore),
                check("submit", "提交答案并查看反馈", submitted)
        ));
    }
}
