package com.k12.platform.learning.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.service.visualmission.VisualMissionTemplate;
import com.k12.platform.learning.service.visualmission.VisualMissionTemplateCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 关卡教学内容与模板配置校验。
 * 禁止控制字符、超长 JSON 与未知模板字段。
 */
@Component
public class VisualProgrammingMissionValidator {
    public static final int MAX_CONFIG_JSON_LENGTH = 20 * 1024;
    private static final Pattern NO_CONTROL = Pattern.compile("^[^\\p{Cntrl}]+$");
    private static final Pattern MISSION_CODE = Pattern.compile("^[a-z0-9-]{1,64}$");
    private static final Pattern KNOWLEDGE_CODE = Pattern.compile("^[a-z0-9._-]{1,128}$");
    private static final Pattern STAGE_CODE = Pattern.compile("^[A-Z_]{1,32}$");

    private final VisualProgrammingMissionTemplateRegistry registry;
    private final ObjectMapper objectMapper;

    public VisualProgrammingMissionValidator(VisualProgrammingMissionTemplateRegistry registry,
                                             ObjectMapper objectMapper) {
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    public VisualMissionTemplateCode requireTemplateCode(String templateCode) {
        return VisualMissionTemplateCode.require(templateCode);
    }

    public void validateMissionCode(String missionCode) {
        requireText(missionCode, 1, 64, "关卡编码");
        if (!MISSION_CODE.matcher(missionCode).matches()) {
            throw new IllegalArgumentException("关卡编码仅允许小写字母、数字和短横线");
        }
    }

    public void validateContent(String title, String shortTitle, String stageCode, String knowledgeCode,
                                String description, String story, String goal, String hint,
                                String badge, String reflection, List<String> steps, List<String> concepts,
                                JsonNode config, String templateCode) {
        requireText(title, 1, 80, "标题");
        requireText(shortTitle, 1, 40, "短标题");
        requireText(stageCode, 1, 32, "学段编码");
        if (!STAGE_CODE.matcher(stageCode).matches()) {
            throw new IllegalArgumentException("学段编码格式不正确");
        }
        requireText(knowledgeCode, 1, 128, "知识点编码");
        if (!KNOWLEDGE_CODE.matcher(knowledgeCode).matches()) {
            throw new IllegalArgumentException("知识点编码格式不正确");
        }
        requireText(description, 1, 300, "描述");
        requireText(story, 1, 600, "故事");
        requireText(goal, 1, 400, "目标");
        requireText(hint, 1, 600, "提示");
        requireText(badge, 1, 40, "徽章");
        requireText(reflection, 1, 500, "反思");
        validateSteps(steps);
        validateConcepts(concepts);
        validateConfig(templateCode, config);
    }

    public void validateConfig(String templateCode, JsonNode config) {
        VisualMissionTemplate template = registry.require(templateCode);
        try {
            String raw = objectMapper.writeValueAsString(config);
            if (raw.length() > MAX_CONFIG_JSON_LENGTH) {
                throw new IllegalArgumentException("模板配置不能超过 20KB");
            }
        } catch (IllegalArgumentException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalArgumentException("模板配置无法序列化");
        }
        template.validateConfig(config);
    }

    private void validateSteps(List<String> steps) {
        if (steps == null || steps.size() != 3) {
            throw new IllegalArgumentException("步骤必须恰好 3 项");
        }
        for (String step : steps) {
            requireText(step, 2, 40, "步骤");
        }
    }

    private void validateConcepts(List<String> concepts) {
        if (concepts == null || concepts.size() < 1 || concepts.size() > 6) {
            throw new IllegalArgumentException("概念数量必须在 1 到 6 之间");
        }
        for (String concept : concepts) {
            requireText(concept, 1, 24, "概念");
        }
    }

    private void requireText(String value, int min, int max, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + "不能为空");
        }
        String trimmed = value.trim();
        if (trimmed.length() < min || trimmed.length() > max) {
            throw new IllegalArgumentException(label + "长度必须在 " + min + " 到 " + max + " 之间");
        }
        if (!NO_CONTROL.matcher(trimmed).matches()) {
            throw new IllegalArgumentException(label + "不能包含控制字符");
        }
    }
}
