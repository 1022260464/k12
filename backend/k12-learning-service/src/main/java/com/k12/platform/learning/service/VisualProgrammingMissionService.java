package com.k12.platform.learning.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.learning.dto.VisualProgrammingMissionCreateRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionDuplicateRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionOrderRequest;
import com.k12.platform.learning.dto.VisualProgrammingMissionPublishedResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionTemplateResponse;
import com.k12.platform.learning.dto.VisualProgrammingMissionUpdateRequest;
import com.k12.platform.learning.mapper.VisualProgrammingMissionMapper;
import com.k12.platform.learning.mapper.VisualProgrammingProjectMapper;
import com.k12.platform.learning.model.VisualProgrammingMission;
import com.k12.platform.learning.model.VisualProgrammingProject;
import com.k12.platform.learning.service.visualmission.VisualMissionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
public class VisualProgrammingMissionService {
    private static final Logger log = LoggerFactory.getLogger(VisualProgrammingMissionService.class);
    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_OFFLINE = "OFFLINE";

    private final VisualProgrammingMissionMapper missionMapper;
    private final VisualProgrammingProjectMapper projectMapper;
    private final VisualProgrammingMissionValidator validator;
    private final VisualProgrammingMissionTemplateRegistry registry;
    private final ObjectMapper objectMapper;

    public VisualProgrammingMissionService(VisualProgrammingMissionMapper missionMapper,
                                           VisualProgrammingProjectMapper projectMapper,
                                           VisualProgrammingMissionValidator validator,
                                           VisualProgrammingMissionTemplateRegistry registry,
                                           ObjectMapper objectMapper) {
        this.missionMapper = missionMapper;
        this.projectMapper = projectMapper;
        this.validator = validator;
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @PreAuthorize("permitAll()")
    public List<VisualProgrammingMissionPublishedResponse> listPublished() {
        return missionMapper.selectList(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                        .eq(VisualProgrammingMission::getStatus, STATUS_PUBLISHED)
                        .orderByAsc(VisualProgrammingMission::getSortOrder)
                        .orderByAsc(VisualProgrammingMission::getId))
                .stream().map(this::toPublished).toList();
    }

    @PreAuthorize("permitAll()")
    public VisualProgrammingMissionPublishedResponse getPublished(String missionCode) {
        VisualProgrammingMission mission = missionMapper.selectOne(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getMissionCode, missionCode)
                .eq(VisualProgrammingMission::getStatus, STATUS_PUBLISHED));
        if (mission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "图形化编程关卡不存在或未发布");
        }
        return toPublished(mission);
    }

    /** 学生提交进度时校验：关卡必须存在且已发布。 */
    public VisualProgrammingMission requirePublishedMission(String missionCode) {
        VisualProgrammingMission mission = missionMapper.selectOne(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getMissionCode, missionCode));
        if (mission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "图形化编程关卡不存在");
        }
        if (!STATUS_PUBLISHED.equals(mission.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡未发布或已下架，暂不能提交进度");
        }
        return mission;
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public List<VisualProgrammingMissionResponse> listAdmin(String status, String templateCode,
                                                            String keyword, String stageCode) {
        LambdaQueryWrapper<VisualProgrammingMission> query = Wrappers.lambdaQuery(VisualProgrammingMission.class);
        if (StringUtils.hasText(status)) query.eq(VisualProgrammingMission::getStatus, status.trim());
        if (StringUtils.hasText(templateCode)) query.eq(VisualProgrammingMission::getTemplateCode, templateCode.trim());
        if (StringUtils.hasText(stageCode)) query.eq(VisualProgrammingMission::getStageCode, stageCode.trim());
        if (StringUtils.hasText(keyword)) {
            String like = "%" + keyword.trim() + "%";
            query.and(wrapper -> wrapper.like(VisualProgrammingMission::getTitle, like)
                    .or().like(VisualProgrammingMission::getMissionCode, like)
                    .or().like(VisualProgrammingMission::getKnowledgeCode, like));
        }
        query.orderByAsc(VisualProgrammingMission::getSortOrder).orderByAsc(VisualProgrammingMission::getId);
        return missionMapper.selectList(query).stream().map(this::toAdmin).toList();
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse getAdmin(long id) {
        return toAdmin(requireMission(id));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public List<VisualProgrammingMissionTemplateResponse> listTemplates() {
        return registry.all().stream()
                .sorted(Comparator.comparing(template -> template.code().name()))
                .map(template -> new VisualProgrammingMissionTemplateResponse(
                        template.code().name(),
                        template.toolboxCategories(),
                        template.allowedBlockTypes(),
                        template.configFields().stream().sorted().toList()))
                .toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse create(VisualProgrammingMissionCreateRequest request) {
        try {
            validator.validateMissionCode(request.missionCode());
            validator.requireTemplateCode(request.templateCode());
            validator.validateContent(request.title(), request.shortTitle(), request.stageCode(),
                    request.knowledgeCode(), request.description(), request.story(), request.goal(),
                    request.hint(), request.badge(), request.reflection(), request.steps(),
                    request.concepts(), request.config(), request.templateCode());
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        }
        if (missionMapper.selectCount(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getMissionCode, request.missionCode())) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡编码已存在");
        }
        Long actorId = K12SecurityContext.requireUserId();
        Instant now = Instant.now();
        VisualProgrammingMission mission = new VisualProgrammingMission();
        mission.setMissionCode(request.missionCode().trim());
        applyEditableFields(mission, request.templateCode(), request.title(), request.shortTitle(),
                request.stageCode(), request.knowledgeCode(), request.description(), request.story(),
                request.goal(), request.hint(), request.badge(), request.reflection(),
                request.steps(), request.concepts(), request.config(), request.sortOrder());
        mission.setStatus(STATUS_DRAFT);
        mission.setContentVersion(1);
        mission.setLockVersion(0);
        mission.setCreatedBy(actorId);
        mission.setUpdatedBy(actorId);
        mission.setCreatedTime(now);
        mission.setUpdatedTime(now);
        missionMapper.insert(mission);
        return toAdmin(mission);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse update(long id, VisualProgrammingMissionUpdateRequest request) {
        VisualProgrammingMission mission = requireMission(id);
        requireLock(mission, request.lockVersion());
        try {
            validator.requireTemplateCode(request.templateCode());
            validator.validateContent(request.title(), request.shortTitle(), request.stageCode(),
                    request.knowledgeCode(), request.description(), request.story(), request.goal(),
                    request.hint(), request.badge(), request.reflection(), request.steps(),
                    request.concepts(), request.config(), request.templateCode());
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        }
        if (!mission.getTemplateCode().equals(request.templateCode()) && countProgress(mission.getMissionCode()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有学生学习记录，不能修改任务模板");
        }
        applyEditableFields(mission, request.templateCode(), request.title(), request.shortTitle(),
                request.stageCode(), request.knowledgeCode(), request.description(), request.story(),
                request.goal(), request.hint(), request.badge(), request.reflection(),
                request.steps(), request.concepts(), request.config(), request.sortOrder());
        mission.setContentVersion(mission.getContentVersion() + 1);
        mission.setUpdatedBy(K12SecurityContext.requireUserId());
        mission.setUpdatedTime(Instant.now());
        updateWithOptimisticLock(mission);
        return toAdmin(mission);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse duplicate(long id, VisualProgrammingMissionDuplicateRequest request) {
        VisualProgrammingMission source = requireMission(id);
        try {
            validator.validateMissionCode(request.missionCode());
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        }
        if (missionMapper.selectCount(Wrappers.lambdaQuery(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getMissionCode, request.missionCode())) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡编码已存在");
        }
        Long actorId = K12SecurityContext.requireUserId();
        Instant now = Instant.now();
        VisualProgrammingMission copy = new VisualProgrammingMission();
        copy.setMissionCode(request.missionCode().trim());
        copy.setTemplateCode(source.getTemplateCode());
        copy.setTitle(StringUtils.hasText(request.title()) ? request.title().trim() : source.getTitle() + "（副本）");
        copy.setShortTitle(source.getShortTitle());
        copy.setStageCode(source.getStageCode());
        copy.setKnowledgeCode(source.getKnowledgeCode());
        copy.setDescription(source.getDescription());
        copy.setStory(source.getStory());
        copy.setGoal(source.getGoal());
        copy.setHint(source.getHint());
        copy.setBadge(source.getBadge());
        copy.setReflection(source.getReflection());
        copy.setStepsJson(source.getStepsJson());
        copy.setConceptsJson(source.getConceptsJson());
        copy.setConfigJson(source.getConfigJson());
        copy.setSortOrder(source.getSortOrder());
        copy.setStatus(STATUS_DRAFT);
        copy.setContentVersion(1);
        copy.setLockVersion(0);
        copy.setCreatedBy(actorId);
        copy.setUpdatedBy(actorId);
        copy.setCreatedTime(now);
        copy.setUpdatedTime(now);
        missionMapper.insert(copy);
        return toAdmin(copy);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse publish(long id) {
        VisualProgrammingMission mission = requireMission(id);
        if (!STATUS_DRAFT.equals(mission.getStatus()) && !STATUS_OFFLINE.equals(mission.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅草稿或已下架关卡可以发布");
        }
        try {
            JsonNode config = readJson(mission.getConfigJson(), "关卡配置");
            validator.validateConfig(mission.getTemplateCode(), config);
            validator.validateContent(mission.getTitle(), mission.getShortTitle(), mission.getStageCode(),
                    mission.getKnowledgeCode(), mission.getDescription(), mission.getStory(), mission.getGoal(),
                    mission.getHint(), mission.getBadge(), mission.getReflection(),
                    readStringList(mission.getStepsJson(), "步骤"),
                    readStringList(mission.getConceptsJson(), "概念"),
                    config, mission.getTemplateCode());
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        }
        mission.setStatus(STATUS_PUBLISHED);
        mission.setPublishedTime(Instant.now());
        mission.setUpdatedBy(K12SecurityContext.requireUserId());
        mission.setUpdatedTime(Instant.now());
        mission.setContentVersion(mission.getContentVersion() + 1);
        updateWithOptimisticLock(mission);
        return toAdmin(mission);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public VisualProgrammingMissionResponse offline(long id) {
        VisualProgrammingMission mission = requireMission(id);
        if (!STATUS_PUBLISHED.equals(mission.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅已发布关卡可以下架");
        }
        mission.setStatus(STATUS_OFFLINE);
        mission.setUpdatedBy(K12SecurityContext.requireUserId());
        mission.setUpdatedTime(Instant.now());
        mission.setContentVersion(mission.getContentVersion() + 1);
        updateWithOptimisticLock(mission);
        return toAdmin(mission);
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public void reorder(VisualProgrammingMissionOrderRequest request) {
        for (VisualProgrammingMissionOrderRequest.Item item : request.items()) {
            VisualProgrammingMission mission = requireMission(item.id());
            requireLock(mission, item.lockVersion());
            mission.setSortOrder(item.sortOrder());
            mission.setUpdatedBy(K12SecurityContext.requireUserId());
            mission.setUpdatedTime(Instant.now());
            updateWithOptimisticLock(mission);
        }
    }

    @Transactional
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public void delete(long id) {
        VisualProgrammingMission mission = requireMission(id);
        if (!STATUS_DRAFT.equals(mission.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "只能删除草稿关卡");
        }
        if (countProgress(mission.getMissionCode()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "已有学生学习记录，不能删除");
        }
        missionMapper.deleteById(id);
    }

    private void applyEditableFields(VisualProgrammingMission mission, String templateCode, String title,
                                     String shortTitle, String stageCode, String knowledgeCode,
                                     String description, String story, String goal, String hint,
                                     String badge, String reflection, List<String> steps,
                                     List<String> concepts, JsonNode config, Integer sortOrder) {
        mission.setTemplateCode(templateCode.trim());
        mission.setTitle(title.trim());
        mission.setShortTitle(shortTitle.trim());
        mission.setStageCode(stageCode.trim());
        mission.setKnowledgeCode(knowledgeCode.trim());
        mission.setDescription(description.trim());
        mission.setStory(story.trim());
        mission.setGoal(goal.trim());
        mission.setHint(hint.trim());
        mission.setBadge(badge.trim());
        mission.setReflection(reflection.trim());
        mission.setStepsJson(writeJson(steps));
        mission.setConceptsJson(writeJson(concepts));
        mission.setConfigJson(writeJson(config));
        mission.setSortOrder(sortOrder == null ? 0 : Math.max(0, sortOrder));
    }

    private VisualProgrammingMission requireMission(long id) {
        VisualProgrammingMission mission = missionMapper.selectById(id);
        if (mission == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "图形化编程关卡不存在");
        }
        return mission;
    }

    private void requireLock(VisualProgrammingMission mission, Integer lockVersion) {
        if (lockVersion == null || !lockVersion.equals(mission.getLockVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡已被其他人修改，请刷新后重试");
        }
    }

    private void updateWithOptimisticLock(VisualProgrammingMission mission) {
        Integer expected = mission.getLockVersion();
        if (expected == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡已被其他人修改，请刷新后重试");
        }
        mission.setLockVersion(expected + 1);
        int updated = missionMapper.update(mission, Wrappers.lambdaUpdate(VisualProgrammingMission.class)
                .eq(VisualProgrammingMission::getId, mission.getId())
                .eq(VisualProgrammingMission::getLockVersion, expected));
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "关卡已被其他人修改，请刷新后重试");
        }
    }

    private long countProgress(String missionCode) {
        return projectMapper.selectCount(Wrappers.lambdaQuery(VisualProgrammingProject.class)
                .eq(VisualProgrammingProject::getMissionCode, missionCode));
    }

    private VisualProgrammingMissionPublishedResponse toPublished(VisualProgrammingMission mission) {
        VisualMissionTemplate template = registry.require(mission.getTemplateCode());
        JsonNode config = readJson(mission.getConfigJson(), "关卡配置");
        return new VisualProgrammingMissionPublishedResponse(
                mission.getId(), mission.getMissionCode(), mission.getTemplateCode(),
                mission.getTitle(), mission.getShortTitle(), mission.getStageCode(),
                mission.getKnowledgeCode(), mission.getDescription(), mission.getStory(),
                mission.getGoal(), mission.getHint(), mission.getBadge(), mission.getReflection(),
                readStringList(mission.getStepsJson(), "步骤"),
                readStringList(mission.getConceptsJson(), "概念"),
                template.toolboxCategories(),
                template.runtimeConfig(config),
                mission.getSortOrder(), mission.getContentVersion());
    }

    private VisualProgrammingMissionResponse toAdmin(VisualProgrammingMission mission) {
        VisualMissionTemplate template = registry.require(mission.getTemplateCode());
        return new VisualProgrammingMissionResponse(
                mission.getId(), mission.getMissionCode(), mission.getTemplateCode(),
                mission.getTitle(), mission.getShortTitle(), mission.getStageCode(),
                mission.getKnowledgeCode(), mission.getDescription(), mission.getStory(),
                mission.getGoal(), mission.getHint(), mission.getBadge(), mission.getReflection(),
                readStringList(mission.getStepsJson(), "步骤"),
                readStringList(mission.getConceptsJson(), "概念"),
                readJson(mission.getConfigJson(), "关卡配置"),
                template.toolboxCategories(),
                mission.getSortOrder(), mission.getStatus(), mission.getContentVersion(),
                mission.getLockVersion(), mission.getCreatedBy(), mission.getUpdatedBy(),
                mission.getPublishedTime(), mission.getCreatedTime(), mission.getUpdatedTime(),
                countProgress(mission.getMissionCode()));
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 内容无法序列化");
        }
    }

    private JsonNode readJson(String raw, String label) {
        try {
            return objectMapper.readTree(raw);
        } catch (Exception error) {
            log.error("图形化编程{}数据损坏", label, error);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, label + "数据损坏");
        }
    }

    private List<String> readStringList(String raw, String label) {
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {
            });
        } catch (Exception error) {
            log.error("图形化编程{}数据损坏", label, error);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, label + "数据损坏");
        }
    }
}
