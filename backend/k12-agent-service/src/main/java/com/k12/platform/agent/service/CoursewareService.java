package com.k12.platform.agent.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeCoursewareRequest;
import com.k12.platform.agent.mapper.AgentCoursewareMapper;
import com.k12.platform.agent.model.AgentCourseware;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * AI 课件生成应用服务：管理端生成草稿 → 审核发布 → 学生端只读已发布。
 * 生成走 Python Runtime 的大模型；本服务负责鉴权、持久化与发布状态。
 */
@Service
public class CoursewareService {

    private static final Logger log = LoggerFactory.getLogger(CoursewareService.class);

    static final int MAX_TOPIC_CHARS = 200;
    static final Set<String> ALLOWED_STAGES =
            Set.of("lower_primary", "upper_primary", "middle_school", "high_school");

    private final AgentRuntimeClient runtimeClient;
    private final AgentCoursewareMapper coursewareMapper;

    public CoursewareService(AgentRuntimeClient runtimeClient, AgentCoursewareMapper coursewareMapper) {
        this.runtimeClient = runtimeClient;
        this.coursewareMapper = coursewareMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public AgentCourseware generate(String rawTopic, String stage, Integer slideCount, String topicCode) {
        String topic = normalize(rawTopic);
        String normalizedStage = StringUtils.hasText(stage) ? stage : "lower_primary";
        if (!ALLOWED_STAGES.contains(normalizedStage)) {
            throw new IllegalArgumentException("学段不合法，请重新选择");
        }
        int slides = slideCount == null ? 6 : Math.max(4, Math.min(10, slideCount));
        JsonNode document;
        try {
            ApiResponse<JsonNode> response = runtimeClient.generateCourseware(
                    new RuntimeCoursewareRequest(topic, normalizedStage, slides, emptyToNull(topicCode)));
            document = response == null ? null : response.data();
        } catch (FeignException exception) {
            log.warn("Courseware generation failed via runtime: status={}", exception.status());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "课件生成服务暂时不可用");
        }
        if (document == null || !document.has("slides") || !document.get("slides").isArray()
                || document.get("slides").isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "课件生成结果不完整，请重试");
        }
        AgentCourseware entity = new AgentCourseware();
        entity.setCoursewareId("cw-" + UUID.randomUUID());
        entity.setTitle(textOr(document.get("title").asText(""), topic, 200));
        entity.setStage(normalizedStage);
        entity.setTopicCode(emptyToNull(topicCode));
        entity.setSlideCount(document.get("slides").size());
        entity.setDocumentJson(document.toString());
        entity.setStatus(AgentCourseware.STATUS_DRAFT);
        entity.setCreatedBy(K12SecurityContext.currentUsername().orElse(null));
        coursewareMapper.insert(entity);
        return entity;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public AgentCourseware publish(String coursewareId, boolean publish) {
        AgentCourseware entity = requireByCoursewareId(coursewareId);
        if (publish) {
            entity.setStatus(AgentCourseware.STATUS_PUBLISHED);
            entity.setPublishTime(Instant.now());
        } else {
            entity.setStatus(AgentCourseware.STATUS_DRAFT);
            entity.setPublishTime(null);
        }
        coursewareMapper.updateById(entity);
        return entity;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public List<AgentCourseware> listAll() {
        return coursewareMapper.selectList(new LambdaQueryWrapper<AgentCourseware>()
                .orderByDesc(AgentCourseware::getId)
                .last("LIMIT 100"));
    }

    /** 学生端课件列表：只暴露已发布的最小字段。 */
    public List<AgentCourseware> listPublished() {
        return coursewareMapper.selectList(new LambdaQueryWrapper<AgentCourseware>()
                .eq(AgentCourseware::getStatus, AgentCourseware.STATUS_PUBLISHED)
                .orderByDesc(AgentCourseware::getPublishTime)
                .last("LIMIT 50"));
    }

    public AgentCourseware getPublished(String coursewareId) {
        AgentCourseware entity = requireByCoursewareId(coursewareId);
        if (!AgentCourseware.STATUS_PUBLISHED.equals(entity.getStatus())
                && !K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课件不存在或尚未发布");
        }
        return entity;
    }

    private AgentCourseware requireByCoursewareId(String coursewareId) {
        AgentCourseware entity = coursewareMapper.selectOne(new LambdaQueryWrapper<AgentCourseware>()
                .eq(AgentCourseware::getCoursewareId, coursewareId)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "课件不存在");
        }
        return entity;
    }

    private String normalize(String rawTopic) {
        if (rawTopic == null || rawTopic.isBlank()) {
            throw new IllegalArgumentException("请填写课件主题");
        }
        String topic = rawTopic.replaceAll("\\s+", " ").trim();
        if (topic.length() > MAX_TOPIC_CHARS) {
            throw new IllegalArgumentException("课件主题不能超过 " + MAX_TOPIC_CHARS + " 个字符");
        }
        return topic;
    }

    private String textOr(String value, String fallback, int max) {
        String text = StringUtils.hasText(value) ? value : fallback;
        return text.length() > max ? text.substring(0, max) : text;
    }

    private String emptyToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
