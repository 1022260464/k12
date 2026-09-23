package com.k12.platform.learning.service.visualmission;

/** 服务端白名单任务模板编码；数据库与管理端只能选用这些值。 */
public enum VisualMissionTemplateCode {
    DATA_LABELING,
    PREDICTION_BRANCH,
    LOOP_ROUTE,
    CONFIDENCE_GATE,
    AGENT_PATROL,
    DATA_BALANCE,
    QUIZ_GAME,
    SEQUENCE_STORY;

    public static VisualMissionTemplateCode require(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("模板编码不能为空");
        }
        try {
            return VisualMissionTemplateCode.valueOf(raw.trim());
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("不支持的任务模板: " + raw);
        }
    }
}
