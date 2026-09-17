package com.k12.platform.agent.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.service.AgentRunPersistenceService;
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
class AgentRunResultConsumerTest {

    @Mock
    private AgentRunPersistenceService persistenceService;

    @Test
    @DisplayName("消费成功结果时把 Python 图表消息转换为数据库产物")
    @SuppressWarnings("unchecked")
    void consumeMapsArtifacts() {
        AgentRunResultConsumer consumer = new AgentRunResultConsumer(persistenceService, new ObjectMapper());
        AgentRunArtifactMessage artifact = new AgentRunArtifactMessage(
                "artifact-1",
                "CHART",
                "application/json",
                "成绩图",
                null,
                new ObjectMapper().createObjectNode().put("mark", "bar")
        );
        Instant startedTime = Instant.parse("2026-09-13T08:41:18Z");
        AgentRunResultMessage result = new AgentRunResultMessage(
                "run-1",
                "demo-chart",
                "SUCCEEDED",
                "完成",
                startedTime,
                List.of(artifact),
                new ObjectMapper().createObjectNode().put("model", "demo")
        );
        when(persistenceService.completeAsyncRun(eq("run-1"), eq("demo-chart"), eq("SUCCEEDED"),
                eq("完成"), eq("{\"model\":\"demo\"}"), eq(startedTime),
                org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(true);

        consumer.consume(result);

        ArgumentCaptor<List<AgentArtifact>> captor = ArgumentCaptor.forClass(List.class);
        verify(persistenceService).completeAsyncRun(
                eq("run-1"),
                eq("demo-chart"),
                eq("SUCCEEDED"),
                eq("完成"),
                eq("{\"model\":\"demo\"}"),
                eq(startedTime),
                captor.capture()
        );
        assertThat(captor.getValue()).singleElement().satisfies(saved -> {
            assertThat(saved.getArtifactId()).isEqualTo("artifact-1");
            assertThat(saved.getRunId()).isEqualTo("run-1");
            assertThat(saved.getPayloadJson()).isEqualTo("{\"mark\":\"bar\"}");
        });
    }

    @Test
    @DisplayName("拒绝未知的异步结果状态")
    void consumeRejectsUnknownStatus() {
        AgentRunResultConsumer consumer = new AgentRunResultConsumer(persistenceService, new ObjectMapper());
        AgentRunResultMessage result = new AgentRunResultMessage(
                "run-1", "demo-chart", "UNKNOWN", "", null, List.of(), null
        );

        assertThatThrownBy(() -> consumer.consume(result))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class)
                .hasRootCauseMessage("Agent 结果状态不合法");
    }

    @Test
    @DisplayName("消费开始消息时记录 Worker 实际开始时间")
    void consumeMarksRunAsStarted() {
        AgentRunResultConsumer consumer = new AgentRunResultConsumer(persistenceService, new ObjectMapper());
        Instant startedTime = Instant.parse("2026-09-13T08:41:18Z");
        AgentRunResultMessage result = new AgentRunResultMessage(
                "run-1", "demo-chart", "RUNNING", "", startedTime, List.of(), null
        );
        when(persistenceService.markAsyncRunStarted("run-1", "demo-chart", startedTime)).thenReturn(true);

        consumer.consume(result);

        verify(persistenceService).markAsyncRunStarted("run-1", "demo-chart", startedTime);
    }
}
