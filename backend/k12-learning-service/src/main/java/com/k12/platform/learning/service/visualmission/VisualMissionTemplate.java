package com.k12.platform.learning.service.visualmission;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;

import java.util.List;
import java.util.Map;
import java.util.Set;

/** 单个 Blockly 任务模板：固定允许积木、配置结构与评分策略。 */
public interface VisualMissionTemplate {
    VisualMissionTemplateCode code();

    Set<String> allowedBlockTypes();

    List<String> toolboxCategories();

    /** 管理端表单可用的 config 字段名白名单。 */
    Set<String> configFields();

    /** 校验 config_json 字段白名单与取值范围。 */
    void validateConfig(JsonNode config);

    /** 返回学生端运行时所需的安全子集，不含评分内部字段时可原样裁剪。 */
    Map<String, Object> runtimeConfig(JsonNode config);

    /** 收集工作区出现的积木类型，供白名单校验。 */
    Set<String> collectBlockTypes(JsonNode workspace);

    VisualProgrammingEvaluationResponse evaluate(JsonNode workspace, JsonNode config);
}
