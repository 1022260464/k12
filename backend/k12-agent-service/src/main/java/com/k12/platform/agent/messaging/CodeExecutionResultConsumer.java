package com.k12.platform.agent.messaging;

import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.service.AgentRunPersistenceService;
import com.k12.platform.agent.service.CodeExecutionRecordMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

/** 消费Python Worker的代码执行结果，并幂等更新MySQL运行记录。 */
@Component
public class CodeExecutionResultConsumer {

    private static final Logger log = LoggerFactory.getLogger(CodeExecutionResultConsumer.class);
    private static final String AGENT_CODE = "code-tutor";
    private static final Set<String> STATUSES =
            Set.of("RUNNING", "SUCCEEDED", "FAILED", "TIMED_OUT", "REJECTED");

    private final AgentRunPersistenceService persistenceService;
    private final CodeExecutionRecordMapper recordMapper;

    public CodeExecutionResultConsumer(
            AgentRunPersistenceService persistenceService,
            CodeExecutionRecordMapper recordMapper
    ) {
        this.persistenceService = persistenceService;
        this.recordMapper = recordMapper;
    }

    @RabbitListener(
            queues = "${k12.agent.rabbitmq.code-result-queue:k12.code.execute.result}",
            autoStartup = "${k12.agent.rabbitmq.enabled:false}"
    )
    public void consume(CodeExecutionResultMessage message) {
        try {
            validate(message);
            if ("RUNNING".equals(message.status())) {
                boolean found = persistenceService.markAsyncRunStarted(
                        message.runId(), AGENT_CODE, message.startedTime()
                );
                if (!found) {
                    log.warn("忽略找不到本地运行记录的代码执行开始消息，runId={}", message.runId());
                }
                return;
            }

            RuntimeCodeExecutionResponse result = toRuntimeResult(message);
            recordMapper.validateResult(result);
            List<AgentArtifact> artifacts = recordMapper.toArtifacts(message.runId(), result.artifacts());
            boolean found = persistenceService.completeAsyncCodeRun(
                    message.runId(),
                    result.status(),
                    result.stdout(),
                    recordMapper.writeExecutionMetadata(result),
                    recordMapper.statusErrorCode(result.status()),
                    recordMapper.statusErrorMessage(result.status()),
                    message.startedTime(),
                    artifacts
            );
            if (!found) {
                log.warn("忽略找不到本地运行记录的代码执行结果，runId={}", message.runId());
            }
        } catch (IllegalArgumentException | ResponseStatusException exception) {
            // 协议本身不合法时重试没有意义，拒绝重入队并交给死信交换机。
            log.error("拒绝非法的代码执行结果消息，runId={}",
                    message == null ? null : message.runId(), exception);
            throw new AmqpRejectAndDontRequeueException("代码执行结果消息不合法", exception);
        }
    }

    private RuntimeCodeExecutionResponse toRuntimeResult(CodeExecutionResultMessage message) {
        List<RuntimeArtifactResponse> artifacts = message.artifacts() == null
                ? List.of()
                : message.artifacts().stream().map(source -> {
                    if (source == null) {
                        return null;
                    }
                    return new RuntimeArtifactResponse(
                            source.artifactId(), source.kind(), source.mimeType(), source.title(),
                            source.uri(), source.payload()
                    );
                }).toList();
        return new RuntimeCodeExecutionResponse(
                message.executionId(), message.status(), message.stdout(), message.stderr(), artifacts,
                message.exitCode(), message.durationMs(), null
        );
    }

    private void validate(CodeExecutionResultMessage message) {
        if (message == null) {
            throw new IllegalArgumentException("代码执行结果消息不能为空");
        }
        if (!StringUtils.hasText(message.runId()) || message.runId().length() > 64) {
            throw new IllegalArgumentException("代码执行结果缺少字段：runId");
        }
        if (!STATUSES.contains(message.status())) {
            throw new IllegalArgumentException("代码执行结果状态不合法");
        }
        if ("RUNNING".equals(message.status()) && message.startedTime() == null) {
            throw new IllegalArgumentException("代码执行开始消息缺少字段：startedTime");
        }
    }
}
