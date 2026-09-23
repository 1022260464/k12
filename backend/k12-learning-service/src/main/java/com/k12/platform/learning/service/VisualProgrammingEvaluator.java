package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import com.k12.platform.learning.mapper.VisualProgrammingMissionMapper;
import com.k12.platform.learning.model.VisualProgrammingMission;
import com.k12.platform.learning.service.visualmission.VisualMissionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * 服务端按数据库关卡配置与白名单模板评分，不能信任前端直接提交的星级或完成状态。
 */
@Component
public class VisualProgrammingEvaluator {
    private static final Logger log = LoggerFactory.getLogger(VisualProgrammingEvaluator.class);

    private final VisualProgrammingMissionMapper missionMapper;
    private final VisualProgrammingMissionTemplateRegistry registry;
    private final ObjectMapper objectMapper;

    public VisualProgrammingEvaluator(VisualProgrammingMissionMapper missionMapper,
                                      VisualProgrammingMissionTemplateRegistry registry,
                                      ObjectMapper objectMapper) {
        this.missionMapper = missionMapper;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    /** 学生提交：仅对已发布关卡评分。 */
    public VisualProgrammingEvaluationResponse evaluate(String missionCode, JsonNode workspace) {
        VisualProgrammingMission mission = missionMapper.selectOne(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getMissionCode, missionCode)
                .eq(VisualProgrammingMission::getStatus, "PUBLISHED"));
        if (mission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "图形化编程关卡不存在或未发布");
        }
        return evaluateMission(mission, workspace);
    }

    /** 使用已加载的关卡实体评分（供 ProjectService 复用，避免重复查询）。 */
    public VisualProgrammingEvaluationResponse evaluateMission(VisualProgrammingMission mission, JsonNode workspace) {
        VisualMissionTemplate template = registry.require(mission.getTemplateCode());
        JsonNode config = readConfig(mission);
        rejectDisallowedBlocks(template, workspace);
        return template.evaluate(workspace, config);
    }

    private void rejectDisallowedBlocks(VisualMissionTemplate template, JsonNode workspace) {
        Set<String> allowed = template.allowedBlockTypes();
        for (String type : template.collectBlockTypes(workspace)) {
            if (!allowed.contains(type)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作区包含当前关卡不允许的积木: " + type);
            }
        }
    }

    private JsonNode readConfig(VisualProgrammingMission mission) {
        try {
            return objectMapper.readTree(mission.getConfigJson());
        } catch (Exception error) {
            log.error("图形化编程关卡配置损坏 missionCode={}", mission.getMissionCode(), error);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "关卡配置数据损坏");
        }
    }
}
