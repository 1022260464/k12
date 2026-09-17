package com.k12.platform.agent.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.service.AgentRunPersistenceService;
import com.k12.platform.agent.service.CodeExecutionRecordMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CodeExecutionResultConsumerTest {

    @Mock
    private AgentRunPersistenceService persistenceService;

    @Test
    @DisplayName("异步代码结果转换为运行元数据和数据库产物")
    @SuppressWarnings("unchecked")
    void consumeStoresCodeResultAndArtifact() {
        ObjectMapper objectMapper = new ObjectMapper();
        CodeExecutionResultConsumer consumer = new CodeExecutionResultConsumer(
                persistenceService, new CodeExecutionRecordMapper(objectMapper)
        );
        Instant startedTime = Instant.parse("2026-09-16T00:10:00Z");
        CodeExecutionResultMessage message = new CodeExecutionResultMessage(
                "run-code-1", "exec-1", "SUCCEEDED", "hello\n", "",
                List.of(new AgentRunArtifactMessage(
                        "artifact-1", "CODE_RESULT", "text/plain", "执行结果", null,
                        objectMapper.createObjectNode().put("language", "python")
                )),
                0, 25L, startedTime
        );
        when(persistenceService.completeAsyncCodeRun(
                eq("run-code-1"), eq("SUCCEEDED"), eq("hello\n"),
                org.mockito.ArgumentMatchers.contains("exec-1"), eq(null), eq(null),
                eq(startedTime), org.mockito.ArgumentMatchers.anyList()
        )).thenReturn(true);

        consumer.consume(message);

        ArgumentCaptor<List<AgentArtifact>> artifacts = ArgumentCaptor.forClass(List.class);
        verify(persistenceService).completeAsyncCodeRun(
                eq("run-code-1"), eq("SUCCEEDED"), eq("hello\n"),
                org.mockito.ArgumentMatchers.contains("exec-1"), eq(null), eq(null),
                eq(startedTime), artifacts.capture()
        );
        assertThat(artifacts.getValue()).singleElement().satisfies(artifact -> {
            assertThat(artifact.getRunId()).isEqualTo("run-code-1");
            assertThat(artifact.getArtifactId()).isEqualTo("artifact-1");
        });
    }

    @Test
    @DisplayName("RUNNING消息记录Worker真正开始时间")
    void consumeMarksCodeRunStarted() {
        CodeExecutionResultConsumer consumer = new CodeExecutionResultConsumer(
                persistenceService, new CodeExecutionRecordMapper(new ObjectMapper())
        );
        Instant startedTime = Instant.parse("2026-09-16T00:10:00Z");
        CodeExecutionResultMessage message = new CodeExecutionResultMessage(
                "run-code-1", null, "RUNNING", "", "", List.of(), null, null, startedTime
        );
        when(persistenceService.markAsyncRunStarted(
                "run-code-1", "code-tutor", startedTime
        )).thenReturn(true);

        consumer.consume(message);

        verify(persistenceService).markAsyncRunStarted("run-code-1", "code-tutor", startedTime);
    }

    @Test
    @DisplayName("缺少executionId的终态消息进入死信")
    void consumeRejectsInvalidTerminalMessage() {
        CodeExecutionResultConsumer consumer = new CodeExecutionResultConsumer(
                persistenceService, new CodeExecutionRecordMapper(new ObjectMapper())
        );
        CodeExecutionResultMessage message = new CodeExecutionResultMessage(
                "run-code-1", null, "SUCCEEDED", "", "", List.of(), 0, 1L, Instant.now()
        );

        assertThatThrownBy(() -> consumer.consume(message))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
}
