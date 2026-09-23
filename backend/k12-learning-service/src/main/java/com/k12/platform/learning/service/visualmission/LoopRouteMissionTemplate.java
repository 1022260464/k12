package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class LoopRouteMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.LOOP_ROUTE;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "controls_repeat_ext", "k12_move", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "control", "motion", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("minRepeatTimes", "maxRepeatTimes", "minDistance", "messageKeyword");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
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
        return pick(config, "minRepeatTimes", "maxRepeatTimes", "minDistance", "messageKeyword");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> program = connectedProgram(workspace);
        JsonNode repeat = flatten(program).stream().filter(block -> type(block).equals("controls_repeat_ext"))
                .findFirst().orElse(null);
        int times = numberField(inputBlock(repeat, "TIMES"), "NUM", 0);
        JsonNode repeatedBody = inputBlock(repeat, "DO");
        int bodyDistance = flatten(repeatedBody == null ? List.of() : List.of(repeatedBody)).stream()
                .filter(block -> type(block).equals("k12_move"))
                .mapToInt(block -> numberField(block, "STEPS", 0)).sum();
        int minTimes = config.path("minRepeatTimes").asInt(2);
        int maxTimes = config.path("maxRepeatTimes").asInt(10);
        int minDistance = config.path("minDistance").asInt(8);
        String keyword = config.path("messageKeyword").asText("任务完成");
        boolean saysFinished = flatten(program).stream()
                .anyMatch(block -> type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("repeat", "使用循环积木", times >= minTimes && times <= maxTimes),
                check("distance", "机器人累计前进至少 " + minDistance + " 步", times * bodyDistance >= minDistance),
                check("finish", "到达后宣布任务完成", saysFinished)
        ));
    }
}
