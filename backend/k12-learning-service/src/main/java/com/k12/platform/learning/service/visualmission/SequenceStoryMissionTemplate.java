package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 顺序故事模板：切换场景、角色说话和等待，组成简单互动绘本。 */
@Component
public class SequenceStoryMissionTemplate extends AbstractVisualMissionTemplate {
    @Override
    public VisualMissionTemplateCode code() {
        return VisualMissionTemplateCode.SEQUENCE_STORY;
    }

    @Override
    public Set<String> allowedBlockTypes() {
        return withShadows(Set.of(
                "k12_when_start", "k12_switch_scene", "k12_wait", "k12_say"));
    }

    @Override
    public List<String> toolboxCategories() {
        return List.of("events", "story", "looks");
    }

    @Override
    protected Set<String> allowedConfigFields() {
        return Set.of("requiredScenes", "minWaitSeconds", "messageKeyword");
    }

    @Override
    protected void validateKnownConfig(JsonNode config) {
        requireStringArray(config, "requiredScenes", 2, 5, safeId(), "必需场景");
        requireIntRange(config, "minWaitSeconds", 1, 10, "最短等待秒数");
        requireKeyword(config);
    }

    @Override
    public Map<String, Object> runtimeConfig(JsonNode config) {
        return pick(config, "requiredScenes", "minWaitSeconds", "messageKeyword");
    }

    @Override
    public VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config) {
        List<JsonNode> blocks = flatten(connectedProgram(workspace));
        List<String> scenes = new ArrayList<>();
        blocks.stream().filter(block -> type(block).equals("k12_switch_scene"))
                .forEach(block -> scenes.add(field(block, "SCENE")));
        List<String> requiredScenes = new ArrayList<>();
        config.path("requiredScenes").forEach(scene -> requiredScenes.add(scene.asText()));

        int minWait = config.path("minWaitSeconds").asInt(1);
        String keyword = config.path("messageKeyword").asText("故事结束");
        boolean closesStory = blocks.stream().anyMatch(block ->
                type(block).equals("k12_say") && field(block, "MESSAGE").contains(keyword));
        return result(List.of(
                check("scenes", "按顺序切换全部故事场景", containsInOrder(scenes, requiredScenes)),
                check("pace", "场景之间保留阅读时间", waitsBetweenScenes(blocks, requiredScenes, minWait)),
                check("ending", "完成故事并说出结束语", closesStory)
        ));
    }

    private boolean containsInOrder(List<String> actual, List<String> expected) {
        int expectedIndex = 0;
        for (String scene : actual) {
            if (expectedIndex < expected.size() && expected.get(expectedIndex).equals(scene)) {
                expectedIndex++;
            }
        }
        return expectedIndex == expected.size();
    }

    private boolean waitsBetweenScenes(List<JsonNode> blocks, List<String> scenes, int minWait) {
        int sceneIndex = 0;
        boolean validWaitSeen = false;
        for (JsonNode block : blocks) {
            if (type(block).equals("k12_wait") && sceneIndex > 0
                    && numberField(block, "SECONDS", 0) >= minWait) {
                validWaitSeen = true;
            }
            if (type(block).equals("k12_switch_scene") && sceneIndex < scenes.size()
                    && scenes.get(sceneIndex).equals(field(block, "SCENE"))) {
                if (sceneIndex > 0 && !validWaitSeen) return false;
                sceneIndex++;
                validWaitSeen = false;
            }
        }
        return sceneIndex == scenes.size();
    }
}
