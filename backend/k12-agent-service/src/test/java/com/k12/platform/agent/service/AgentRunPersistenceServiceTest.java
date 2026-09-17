package com.k12.platform.agent.service;

import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentRunPersistenceServiceTest {

    @Mock
    private AgentRunMapper runMapper;
    @Mock
    private AgentArtifactMapper artifactMapper;

    @Test
    @DisplayName("同步代码执行结果在短事务内更新终态并写入产物")
    void completeSyncCodeRunStoresTerminalResult() {
        AgentRun run = syncCodeRun();
        when(runMapper.selectForUpdateByRunId("code-run-1")).thenReturn(run);
        AgentArtifact artifact = new AgentArtifact();
        artifact.setArtifactId("artifact-code-1");

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        service.completeSyncCodeRun(
                "code-run-1", "SUCCEEDED", "hello\n", "{\"executionId\":\"exec-1\"}",
                null, null, List.of(artifact)
        );

        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getOutputText()).isEqualTo("hello\n");
        assertThat(run.getFinishedTime()).isNotNull();
        assertThat(run.getDurationMs()).isNotNegative();
        verify(runMapper).updateById(run);
        verify(artifactMapper).insert(artifact);
    }

    @Test
    @DisplayName("同步代码执行基础设施失败会留下脱敏失败记录")
    void failSyncCodeRunStoresSanitizedFailure() {
        AgentRun run = syncCodeRun();
        when(runMapper.selectForUpdateByRunId("code-run-1")).thenReturn(run);

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        service.failSyncCodeRun("code-run-1", "SANDBOX_HTTP_503", "代码执行服务暂不可用");

        assertThat(run.getStatus()).isEqualTo("FAILED");
        assertThat(run.getErrorCode()).isEqualTo("SANDBOX_HTTP_503");
        assertThat(run.getErrorMessage()).isEqualTo("代码执行服务暂不可用");
        verify(runMapper).updateById(run);
    }

    @Test
    @DisplayName("异步代码终态幂等写入运行记录和产物")
    void completeAsyncCodeRunStoresResult() {
        AgentRun run = syncCodeRun();
        run.setExecutionMode("ASYNC");
        run.setStatus("RUNNING");
        when(runMapper.selectForUpdateByRunId("code-run-1")).thenReturn(run);
        AgentArtifact artifact = new AgentArtifact();
        artifact.setArtifactId("artifact-code-1");
        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);

        assertThat(service.completeAsyncCodeRun(
                "code-run-1", "SUCCEEDED", "hello\n", "{\"executionId\":\"exec-1\"}",
                null, null, run.getStartedTime(), List.of(artifact)
        )).isTrue();
        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        verify(runMapper).updateById(run);
        verify(artifactMapper).insert(artifact);

        assertThat(service.completeAsyncCodeRun(
                "code-run-1", "SUCCEEDED", "duplicate", "{}",
                null, null, run.getStartedTime(), List.of(new AgentArtifact())
        )).isTrue();
        verify(runMapper).updateById(run);
        verify(artifactMapper).insert(artifact);
    }

    @Test
    @DisplayName("异步成功结果更新运行记录并写入产物")
    void completeAsyncRunStoresResultAndArtifact() {
        AgentRun run = pendingRun();
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        AgentArtifact artifact = new AgentArtifact();
        artifact.setArtifactId("artifact-1");

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        Instant startedTime = Instant.now().minusMillis(100);
        boolean found = service.completeAsyncRun(
                "run-1", "demo-chart", "SUCCEEDED", "完成", "{}", startedTime, List.of(artifact)
        );

        assertThat(found).isTrue();
        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getOutputText()).isEqualTo("完成");
        assertThat(run.getStartedTime()).isEqualTo(startedTime);
        verify(artifactMapper).insert(artifact);
        verify(runMapper).updateById(run);
    }

    @Test
    @DisplayName("重复投递终态结果时不重复写入产物")
    void completeAsyncRunIsIdempotentForTerminalRun() {
        AgentRun run = pendingRun();
        run.setStatus("SUCCEEDED");
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        boolean found = service.completeAsyncRun(
                "run-1", "demo-chart", "SUCCEEDED", "重复结果", "{}", Instant.now(),
                List.of(new AgentArtifact())
        );

        assertThat(found).isTrue();
        verify(artifactMapper, never()).insert(any(AgentArtifact.class));
        verify(runMapper, never()).updateById(any(AgentRun.class));
    }

    @Test
    @DisplayName("异步失败结果不会把 Python 原始异常暴露给前端")
    void completeAsyncFailureSanitizesError() {
        AgentRun run = pendingRun();
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        service.completeAsyncRun(
                "run-1", "demo-chart", "FAILED", "SecretError: token leaked", "{}", Instant.now(), List.of()
        );

        assertThat(run.getOutputText()).isNull();
        assertThat(run.getErrorCode()).isEqualTo("AGENT_EXECUTION_FAILED");
        assertThat(run.getErrorMessage()).isEqualTo("智能体执行失败");
    }

    @Test
    @DisplayName("Worker 开始执行时更新运行状态和开始时间")
    void markAsyncRunStartedUpdatesPendingRun() {
        AgentRun run = pendingRun();
        Instant startedTime = Instant.parse("2026-09-13T08:41:18Z");
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);

        AgentRunPersistenceService service = new AgentRunPersistenceService(runMapper, artifactMapper);
        boolean found = service.markAsyncRunStarted("run-1", "demo-chart", startedTime);

        assertThat(found).isTrue();
        assertThat(run.getStatus()).isEqualTo("RUNNING");
        assertThat(run.getStartedTime()).isEqualTo(startedTime);
        verify(runMapper).updateById(run);
    }

    private AgentRun pendingRun() {
        AgentRun run = new AgentRun();
        run.setRunId("run-1");
        run.setUserId(42L);
        run.setAgentCode("demo-chart");
        run.setExecutionMode("ASYNC");
        run.setStatus("PENDING");
        run.setCreatedTime(Instant.now().minusSeconds(1));
        return run;
    }

    private AgentRun syncCodeRun() {
        AgentRun run = new AgentRun();
        run.setRunId("code-run-1");
        run.setAgentCode("code-tutor");
        run.setUserId(42L);
        run.setExecutionMode("SYNC");
        run.setStatus("RUNNING");
        run.setStartedTime(Instant.now().minusMillis(10));
        run.setCreatedTime(run.getStartedTime());
        return run;
    }

    @Test
    @DisplayName("越权取消返回 404，不能修改其他人的任务")
    void cancelHidesOtherUsersRun() {
        AgentRun run = pendingRun();
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        var service = new AgentRunPersistenceService(runMapper, artifactMapper);
        assertThatThrownBy(() -> service.cancelAsyncRun("run-1", 99L, false))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(runMapper, never()).updateById(any(AgentRun.class));
    }

    @Test
    @DisplayName("重复取消幂等，已完成任务取消返回 409")
    void cancelIsIdempotentAndRejectsCompletedRun() {
        AgentRun run = pendingRun();
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        var service = new AgentRunPersistenceService(runMapper, artifactMapper);
        service.cancelAsyncRun("run-1", 42L, false);
        Instant finished = run.getFinishedTime();
        service.cancelAsyncRun("run-1", 42L, false);
        assertThat(run.getStatus()).isEqualTo("CANCELLED");
        assertThat(run.getFinishedTime()).isEqualTo(finished);
        verify(runMapper).updateById(run);
        run.setStatus("SUCCEEDED");
        assertThatThrownBy(() -> service.cancelAsyncRun("run-1", 42L, false))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CANCELLED", "TIMED_OUT", "SUCCEEDED", "FAILED"})
    @DisplayName("迟到的开始和成功消息不能覆盖终态或插入新产物")
    void lateMessagesDoNotOverwriteTerminalState(String status) {
        AgentRun run = pendingRun();
        run.setStatus(status);
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        var service = new AgentRunPersistenceService(runMapper, artifactMapper);
        service.markAsyncRunStarted("run-1", "demo-chart", Instant.now());
        service.completeAsyncRun("run-1", "demo-chart", "SUCCEEDED", "late", "{}",
                Instant.now(), List.of(new AgentArtifact()));
        assertThat(run.getStatus()).isEqualTo(status);
        verify(runMapper, never()).updateById(any(AgentRun.class));
        verify(artifactMapper, never()).insert(any(AgentArtifact.class));
    }

    @Test
    @DisplayName("超时按实际执行开始时间判断，排队久但刚开始执行不会超时")
    void runningTimeoutUsesStartedTimeAndRechecksState() {
        Instant now = Instant.now();
        AgentRun run = pendingRun();
        run.setCreatedTime(now.minusSeconds(7200));
        run.setStatus("RUNNING");
        run.setStartedTime(now.minusSeconds(10));
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        var service = new AgentRunPersistenceService(runMapper, artifactMapper);
        assertThat(service.timeoutAsyncRun("run-1", now.minusSeconds(3600), now.minusSeconds(900), now)).isFalse();
        run.setStartedTime(now.minusSeconds(901));
        assertThat(service.timeoutAsyncRun("run-1", now.minusSeconds(3600), now.minusSeconds(900), now)).isTrue();
        assertThat(run.getErrorCode()).isEqualTo("EXECUTION_TIMEOUT");
        assertThat(run.getStatus()).isEqualTo("TIMED_OUT");
        assertThat(service.timeoutAsyncRun("run-1", now, now, now)).isFalse();
        verify(runMapper).updateById(run);
    }

    @Test
    @DisplayName("排队超时保存结束时间，并保留未开始的事实")
    void pendingTimeoutKeepsNullStartedTime() {
        Instant now = Instant.now();
        AgentRun run = pendingRun();
        run.setCreatedTime(now.minusSeconds(3600));
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        var service = new AgentRunPersistenceService(runMapper, artifactMapper);
        assertThat(service.timeoutAsyncRun("run-1", now.minusSeconds(3600), now, now)).isTrue();
        assertThat(run.getStartedTime()).isNull();
        assertThat(run.getFinishedTime()).isEqualTo(now);
        assertThat(run.getErrorCode()).isEqualTo("QUEUE_TIMEOUT");
    }

    @Test
    @DisplayName("投递异常不能把已经开始的任务改成失败")
    void dispatchFailureDoesNotOverwriteRunning() {
        AgentRun run = pendingRun();
        run.setStatus("RUNNING");
        when(runMapper.selectForUpdateByRunId("run-1")).thenReturn(run);
        new AgentRunPersistenceService(runMapper, artifactMapper).markDispatchFailed("run-1");
        verify(runMapper, never()).updateById(any(AgentRun.class));
    }
}
