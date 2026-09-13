package com.k12.platform.agent.service;

import com.k12.platform.agent.config.AgentRunLifecycleProperties;
import com.k12.platform.agent.mapper.AgentRunMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgentRunTimeoutJobTest {
    @Test
    @DisplayName("单个超时事务失败不影响其余候选任务，扫描有批量上限")
    void failedRowDoesNotBlockNextCandidate() {
        AgentRunMapper mapper = mock(AgentRunMapper.class);
        AgentRunPersistenceService persistence = mock(AgentRunPersistenceService.class);
        when(mapper.findExpiredRunIds(any(), any(), eq(100))).thenReturn(List.of("bad", "good"));
        when(persistence.timeoutAsyncRun(eq("bad"), any(), any(), any())).thenThrow(new IllegalStateException("test"));
        when(persistence.timeoutAsyncRun(eq("good"), any(), any(), any())).thenAnswer(call -> {
            Instant queueCutoff = call.getArgument(1);
            Instant executionCutoff = call.getArgument(2);
            Instant now = call.getArgument(3);
            assertThat(Duration.between(queueCutoff, now).getSeconds()).isEqualTo(3600);
            assertThat(Duration.between(executionCutoff, now).getSeconds()).isEqualTo(900);
            return true;
        });
        new AgentRunTimeoutJob(mapper, persistence, new AgentRunLifecycleProperties()).expireRuns();
        verify(persistence).timeoutAsyncRun(eq("good"), any(), any(), any());
    }
}
