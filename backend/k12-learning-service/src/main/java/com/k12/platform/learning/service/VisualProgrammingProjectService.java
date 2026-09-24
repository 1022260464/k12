package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.VisualProgrammingEvaluationResponse;
import com.k12.platform.learning.dto.VisualProgrammingProjectRequest;
import com.k12.platform.learning.dto.VisualProgrammingProjectResponse;
import com.k12.platform.learning.mapper.VisualProgrammingProjectMapper;
import com.k12.platform.learning.model.VisualProgrammingMission;
import com.k12.platform.learning.model.VisualProgrammingProject;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class VisualProgrammingProjectService {
    private static final int MAX_WORKSPACE_JSON_LENGTH = 100_000;

    private final VisualProgrammingProjectMapper mapper;
    private final VisualProgrammingMissionService missionService;
    private final VisualProgrammingEvaluator evaluator;
    private final ObjectMapper objectMapper;
    private final LearningEventService eventService;

    public VisualProgrammingProjectService(VisualProgrammingProjectMapper mapper,
                                           VisualProgrammingMissionService missionService,
                                           VisualProgrammingEvaluator evaluator,
                                           ObjectMapper objectMapper,
                                           LearningEventService eventService) {
        this.mapper = mapper;
        this.missionService = missionService;
        this.evaluator = evaluator;
        this.objectMapper = objectMapper;
        this.eventService = eventService;
    }

    @PreAuthorize("isAuthenticated()")
    public List<VisualProgrammingProjectResponse> listMine() {
        Long userId = K12SecurityContext.requireUserId();
        return mapper.selectList(Wrappers.lambdaQuery(VisualProgrammingProject.class)
                        .eq(VisualProgrammingProject::getStudentUserId, userId)
                        .orderByAsc(VisualProgrammingProject::getMissionCode))
                .stream().map(project -> response(project, null)).toList();
    }

    @Transactional
    @PreAuthorize("isAuthenticated()")
    public VisualProgrammingProjectResponse save(String missionCode, VisualProgrammingProjectRequest request) {
        VisualProgrammingMission mission = missionService.requirePublishedMission(missionCode);
        String workspaceJson = writeWorkspace(request.workspace());
        VisualProgrammingEvaluationResponse evaluation = evaluator.evaluateMission(mission, request.workspace());
        Long userId = K12SecurityContext.requireUserId();
        VisualProgrammingProject project = mapper.selectOne(Wrappers.lambdaQuery(VisualProgrammingProject.class)
                .eq(VisualProgrammingProject::getStudentUserId, userId)
                .eq(VisualProgrammingProject::getMissionCode, missionCode));
        Instant now = Instant.now();
        if (project == null) {
            project = new VisualProgrammingProject();
            project.setStudentUserId(userId);
            project.setMissionCode(missionCode);
            project.setCreatedTime(now);
            project.setBestStars(0);
            project.setAttemptCount(0);
        }
        project.setWorkspaceJson(workspaceJson);
        project.setBestStars(Math.max(project.getBestStars(), evaluation.stars()));
        project.setAttemptCount(project.getAttemptCount() + 1);
        if (evaluation.passed()) {
            project.setStatus("COMPLETED");
            if (project.getCompletedTime() == null) project.setCompletedTime(now);
        } else if (!"COMPLETED".equals(project.getStatus())) {
            project.setStatus("IN_PROGRESS");
        }
        project.setUpdatedTime(now);
        if (project.getId() == null) mapper.insert(project);
        else mapper.updateById(project);
        eventService.record(userId, evaluation.passed() ? "VISUAL_MISSION_COMPLETED" : "VISUAL_MISSION_ATTEMPTED",
                "VISUAL_MISSION", missionCode, null, null, mission.getKnowledgeCode(), mission.getTitle(),
                evaluation.passed() ? "图形化编程关卡完成" : "保存一次图形化编程尝试",
                "{\"stars\":" + evaluation.stars() + ",\"passed\":" + evaluation.passed() + "}",
                "visual-mission:" + project.getId() + ":" + project.getAttemptCount(), now);
        return response(project, evaluation);
    }

    private String writeWorkspace(JsonNode workspace) {
        try {
            String value = objectMapper.writeValueAsString(workspace);
            if (value.length() > MAX_WORKSPACE_JSON_LENGTH) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积木工作区内容过大");
            }
            return value;
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积木工作区格式不正确");
        }
    }

    private VisualProgrammingProjectResponse response(
            VisualProgrammingProject project,
            VisualProgrammingEvaluationResponse evaluation
    ) {
        try {
            return new VisualProgrammingProjectResponse(project.getMissionCode(),
                    objectMapper.readTree(project.getWorkspaceJson()), project.getStatus(),
                    project.getBestStars(), project.getAttemptCount(), project.getCompletedTime(),
                    project.getUpdatedTime(), evaluation);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("图形化编程工作区数据损坏", error);
        }
    }
}
