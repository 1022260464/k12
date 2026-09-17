package com.k12.platform.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionRequest;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.messaging.CodeExecutionTaskMessage;
import com.k12.platform.agent.messaging.CodeExecutionTaskPublisher;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.api.ApiResponse;
import feign.FeignException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CodeExecutionServiceTest {

    @Mock
    private AgentRuntimeClient runtimeClient;
    @Mock
    private AgentRunPersistenceService persistenceService;
    @Mock
    private CodeExecutionTaskPublisher taskPublisher;
    @Mock
    private CodeExecutionQuotaService quotaService;
    private final AgentRabbitProperties rabbitProperties = new AgentRabbitProperties();

    @AfterEach
    void clearIdentity() {
        SecurityContextHolder.clearContext();
        rabbitProperties.setEnabled(false);
    }

    @Test
    @DisplayName("使用默认超时调用沙箱且保留Python代码缩进")
    void executeUsesSafeDefaultsAndPreservesCode() {
        authenticate(42L);
        String code = "  for value in [1, 2]:\n      print(value)";
        var payload = new ObjectMapper().createObjectNode().put("language", "python");
        RuntimeCodeExecutionResponse runtimeResponse = new RuntimeCodeExecutionResponse(
                "exec-1", "SUCCEEDED", "1\n2\n", "", List.of(new RuntimeArtifactResponse(
                        "artifact-1", "CODE_RESULT", "text/plain", "执行结果", null, payload
                )), 0, 120L, "provider-1"
        );
        when(runtimeClient.executeCode(org.mockito.ArgumentMatchers.any()))
                .thenReturn(ApiResponse.ok(runtimeResponse));
        CodeExecutionService service = service();

        CodeExecutionOutcome outcome = service.execute(code, null, null);

        ArgumentCaptor<RuntimeCodeExecutionRequest> captor =
                ArgumentCaptor.forClass(RuntimeCodeExecutionRequest.class);
        verify(runtimeClient).executeCode(captor.capture());
        assertThat(captor.getValue().code()).isEqualTo(code);
        assertThat(captor.getValue().timeoutSeconds()).isEqualTo(30);
        assertThat(captor.getValue().packages()).isEmpty();
        assertThat(outcome.execution().executionId()).isEqualTo("exec-1");
        assertThat(outcome.runId()).isNotBlank();

        ArgumentCaptor<AgentRun> runCaptor = ArgumentCaptor.forClass(AgentRun.class);
        verify(persistenceService).save(runCaptor.capture(), org.mockito.ArgumentMatchers.eq(List.of()));
        assertThat(runCaptor.getValue().getUserId()).isEqualTo(42L);
        assertThat(runCaptor.getValue().getAgentCode()).isEqualTo("code-tutor");
        assertThat(runCaptor.getValue().getStatus()).isEqualTo("RUNNING");
        assertThat(runCaptor.getValue().getInputText()).isEqualTo(code);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AgentArtifact>> artifactCaptor = ArgumentCaptor.forClass(List.class);
        verify(persistenceService).completeSyncCodeRun(
                org.mockito.ArgumentMatchers.eq(outcome.runId()),
                org.mockito.ArgumentMatchers.eq("SUCCEEDED"),
                org.mockito.ArgumentMatchers.eq("1\n2\n"),
                org.mockito.ArgumentMatchers.argThat(metadata -> metadata.contains("exec-1")
                        && !metadata.contains("provider-1")),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(),
                artifactCaptor.capture()
        );
        assertThat(artifactCaptor.getValue()).singleElement().satisfies(artifact -> {
            assertThat(artifact.getRunId()).isEqualTo(outcome.runId());
            assertThat(artifact.getArtifactId()).isEqualTo("artifact-1");
        });
    }

    @Test
    @DisplayName("非法代码和超时时间在调用Runtime前被拒绝")
    void invalidInputIsRejectedBeforeRuntimeCall() {
        CodeExecutionService service = service();

        assertThatThrownBy(() -> service.execute("   ", 10, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("代码不能为空");
        assertThatThrownBy(() -> service.execute("print(1)", 0, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("1 到 30");
        assertThatThrownBy(() -> service.execute("print(1)", 31, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("1 到 30");
        verify(runtimeClient, never()).executeCode(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("Runtime返回空数据时转换为502")
    void invalidRuntimeResponseBecomesBadGateway() {
        authenticate(42L);
        when(runtimeClient.executeCode(org.mockito.ArgumentMatchers.any()))
                .thenReturn(ApiResponse.fail(503, "沙箱不可用"));
        CodeExecutionService service = service();

        assertThatThrownBy(() -> service.execute("print(1)", 10, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, error ->
                        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        verify(persistenceService).failSyncCodeRun(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq("SANDBOX_INVALID_RESPONSE"),
                org.mockito.ArgumentMatchers.eq("代码执行服务返回数据不合法")
        );
    }

    @Test
    @DisplayName("Runtime不可用时转换为503且不泄露上游响应")
    void unavailableRuntimeBecomesServiceUnavailable() {
        authenticate(42L);
        FeignException exception = mock(FeignException.class);
        when(exception.status()).thenReturn(503);
        when(runtimeClient.executeCode(org.mockito.ArgumentMatchers.any()))
                .thenThrow(exception);
        CodeExecutionService service = service();

        assertThatThrownBy(() -> service.execute("print(1)", 10, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(error.getReason()).contains("代码执行服务暂不可用，运行编号：");
                });
        verify(persistenceService).failSyncCodeRun(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq("SANDBOX_HTTP_503"),
                org.mockito.ArgumentMatchers.eq("代码执行服务暂不可用")
        );
    }

    @Test
    @DisplayName("异步模式创建PENDING记录并发布独立代码任务")
    void asyncExecutionPersistsPendingRunAndPublishesTask() {
        authenticate(42L);
        rabbitProperties.setEnabled(true);
        CodeExecutionService service = service();

        CodeExecutionOutcome outcome = service.execute("print('async')", 12, "ASYNC");

        assertThat(outcome.execution().status()).isEqualTo("PENDING");
        assertThat(outcome.execution().executionId()).isNull();
        ArgumentCaptor<AgentRun> runCaptor = ArgumentCaptor.forClass(AgentRun.class);
        verify(persistenceService).save(runCaptor.capture(), org.mockito.ArgumentMatchers.eq(List.of()));
        assertThat(runCaptor.getValue().getExecutionMode()).isEqualTo("ASYNC");
        assertThat(runCaptor.getValue().getStatus()).isEqualTo("PENDING");
        assertThat(runCaptor.getValue().getStartedTime()).isNull();
        ArgumentCaptor<CodeExecutionTaskMessage> taskCaptor =
                ArgumentCaptor.forClass(CodeExecutionTaskMessage.class);
        verify(taskPublisher).publish(taskCaptor.capture());
        assertThat(taskCaptor.getValue().runId()).isEqualTo(outcome.runId());
        assertThat(taskCaptor.getValue().timeoutSeconds()).isEqualTo(12);
        verify(runtimeClient, never()).executeCode(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("日配额耗尽时同步和异步请求均不得保存或投递")
    void quotaExceededRejectsBeforeSideEffects() {
        authenticate(42L);
        rabbitProperties.setEnabled(true);
        org.mockito.Mockito.doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "今日代码运行次数已用完"))
                .when(quotaService).reserve(42L);
        CodeExecutionService service = service();

        for (String mode : List.of("SYNC", "ASYNC")) {
            assertThatThrownBy(() -> service.execute("print(1)", 10, mode))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error ->
                            assertThat(error.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        }
        verify(persistenceService, never()).save(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(runtimeClient, never()).executeCode(org.mockito.ArgumentMatchers.any());
        verify(taskPublisher, never()).publish(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("未启用异步执行时不占用日配额")
    void disabledAsyncDoesNotUseQuota() {
        authenticate(42L);

        assertThatThrownBy(() -> service().execute("print(1)", 10, "ASYNC"))
                .isInstanceOfSatisfying(ResponseStatusException.class, error ->
                        assertThat(error.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verify(quotaService, never()).reserve(org.mockito.ArgumentMatchers.anyLong());
    }

    private CodeExecutionService service() {
        return new CodeExecutionService(
                runtimeClient,
                persistenceService,
                new CodeExecutionRecordMapper(new ObjectMapper()),
                taskPublisher,
                rabbitProperties,
                quotaService
        );
    }

    private void authenticate(Long userId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("student001")
                .claim("userId", userId.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt,
                List.of(new SimpleGrantedAuthority("agent:invoke"))
        ));
    }
}
