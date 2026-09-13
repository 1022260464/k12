package com.k12.platform.agent.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.service.AgentRunPersistenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** 消费 Python Worker 结果，并交给事务层幂等更新 agent_run 与 agent_artifact。 */
@Component
public class AgentRunResultConsumer {

    private static final Logger log = LoggerFactory.getLogger(AgentRunResultConsumer.class);
    private static final Set<String> RESULT_STATUSES = Set.of("RUNNING", "SUCCEEDED", "FAILED");

    private final AgentRunPersistenceService persistenceService;
    private final ObjectMapper objectMapper;

    public AgentRunResultConsumer(AgentRunPersistenceService persistenceService, ObjectMapper objectMapper) {
        this.persistenceService = persistenceService;
        this.objectMapper = objectMapper;
    }

    @RabbitListener(
            queues = "${k12.agent.rabbitmq.result-queue:k12.agent.run.result}",
            autoStartup = "${k12.agent.rabbitmq.enabled:false}"
    )
    public void consume(AgentRunResultMessage result) {
        try {
            validate(result);
            if ("RUNNING".equals(result.status())) {
                boolean found = persistenceService.markAsyncRunStarted(
                        result.runId(),
                        result.agentCode(),
                        result.startedTime()
                );
                if (!found) {
                    log.warn("忽略找不到本地运行记录的 Agent 开始消息，runId={}", result.runId());
                }
                return;
            }

            boolean found = persistenceService.completeAsyncRun(
                    result.runId(),
                    result.agentCode(),
                    result.status(),
                    result.outputText(),
                    writeJson(result.metadata()),
                    result.startedTime(),
                    toArtifacts(result)
            );
            if (!found) {
                log.warn("忽略找不到本地运行记录的 Agent 结果，runId={}", result.runId());
            }
        } catch (IllegalArgumentException exception) {
            // 消息内容本身有问题，重新投递也无法成功；拒绝重入队并交给死信交换机。
            log.error("拒绝非法的 Agent 结果消息，runId={}", result == null ? null : result.runId(), exception);
            throw new AmqpRejectAndDontRequeueException("Agent 结果消息不合法", exception);
        }
    }

    private List<AgentArtifact> toArtifacts(AgentRunResultMessage result) {
        if (result.artifacts() == null || result.artifacts().isEmpty()) {
            return List.of();
        }
        List<AgentArtifact> artifacts = new ArrayList<>(result.artifacts().size());
        for (AgentRunArtifactMessage source : result.artifacts()) {
            if (source == null) {
                throw new IllegalArgumentException("Agent 产物不能为空");
            }
            requireText(source.artifactId(), 64, "artifactId");
            requireText(source.kind(), 32, "kind");
            requireText(source.mimeType(), 128, "mimeType");
            requireLength(source.title(), 255, "title");
            requireLength(source.uri(), 1024, "uri");

            AgentArtifact artifact = new AgentArtifact();
            artifact.setArtifactId(source.artifactId());
            artifact.setRunId(result.runId());
            artifact.setKind(source.kind());
            artifact.setMimeType(source.mimeType());
            artifact.setTitle(source.title());
            artifact.setStorageUri(source.uri());
            artifact.setPayloadJson(writeJson(source.payload()));
            artifact.setCreatedTime(Instant.now());
            artifacts.add(artifact);
        }
        return artifacts;
    }

    private void validate(AgentRunResultMessage result) {
        if (result == null) {
            throw new IllegalArgumentException("Agent 结果消息不能为空");
        }
        requireText(result.runId(), 64, "runId");
        requireText(result.agentCode(), 64, "agentCode");
        if (result.status() == null || !RESULT_STATUSES.contains(result.status())) {
            throw new IllegalArgumentException("Agent 结果状态不合法");
        }
        if ("RUNNING".equals(result.status()) && result.startedTime() == null) {
            throw new IllegalArgumentException("Agent 开始消息缺少字段：startedTime");
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Agent 结果 JSON 无法序列化", exception);
        }
    }

    private void requireText(String value, int maxLength, String field) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException("Agent 结果缺少字段：" + field);
        }
        requireLength(value, maxLength, field);
    }

    private void requireLength(String value, int maxLength, String field) {
        if (value != null && value.length() > maxLength) {
            throw new IllegalArgumentException("Agent 结果字段过长：" + field);
        }
    }
}
