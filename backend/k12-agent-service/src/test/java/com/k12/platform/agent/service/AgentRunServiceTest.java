package com.k12.platform.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeAgentInvokeRequest;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.dto.AgentRunPageResponse;
import com.k12.platform.agent.dto.AgentRunRequest;
import com.k12.platform.agent.dto.AgentRunResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.messaging.AgentRunTaskMessage;
import com.k12.platform.agent.messaging.AgentRunTaskPublisher;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.agent.model.TeachingAgent;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import feign.FeignException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentRunServiceTest {

    @Mock
    private AgentMapper agentMapper;
    @Mock
    private AgentRunMapper runMapper;
    @Mock
    private AgentArtifactMapper artifactMapper;
    @Mock
    private AgentRuntimeClient runtimeClient;
    @Mock
    private AgentRunPersistenceService persistenceService;
    @Mock
    private AgentRunTaskPublisher taskPublisher;
    @Mock
    private LearnerContextEnricher learnerContextEnricher;
    @Mock
    private AgentSessionService sessionService;

    private AgentRunService runService;
    private AgentRabbitProperties rabbitProperties;

    @BeforeEach
    void setUp() {
        rabbitProperties = new AgentRabbitProperties();
        runService = new AgentRunService(
                agentMapper,
                runMapper,
                artifactMapper,
                runtimeClient,
                persistenceService,
                taskPublisher,
                rabbitProperties,
                new ObjectMapper(),
                learnerContextEnricher,
                sessionService
        );
        lenient().when(learnerContextEnricher.enrich(any(), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(2));
        lenient().when(sessionService.enrichContext(any(), any(), any(), any()))
                .thenAnswer(invocation -> invocation.getArgument(3));
        authenticate(42L, K12Authorities.AGENT_READ, K12Authorities.AGENT_INVOKE);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("运行智能体时使用 JWT 用户 ID，并保存结果和图表产物")
    void createRunUsesJwtIdentityAndPersistsResult() {
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());
        RuntimeArtifactResponse artifact = new RuntimeArtifactResponse(
                "artifact-1",
                "CHART",
                "application/vnd.vegalite+json",
                "学习情况",
                null,
                new ObjectMapper().createObjectNode().put("mark", "bar")
        );
        RuntimeAgentRunResponse runtimeResult = new RuntimeAgentRunResponse(
                "run-1",
                "demo-chart",
                "SUCCEEDED",
                "图表生成完成",
                List.of(artifact),
                new ObjectMapper().createObjectNode().put("model", "demo")
        );
        when(runtimeClient.invoke(eq("demo-chart"), any()))
                .thenReturn(ApiResponse.ok(runtimeResult));

        AgentRunResponse response = runService.createRun(
                "demo-chart",
                new AgentRunRequest("分析本周成绩", "session-1", "SYNC", Map.of("grade", 8))
        );

        ArgumentCaptor<RuntimeAgentInvokeRequest> runtimeRequest =
                ArgumentCaptor.forClass(RuntimeAgentInvokeRequest.class);
        verify(runtimeClient).invoke(eq("demo-chart"), runtimeRequest.capture());
        assertThat(runtimeRequest.getValue().userId()).isEqualTo("42");
        verify(sessionService).enrichContext(42L, "demo-chart", "session-1", Map.of("grade", 8));
        assertThat(response.runId()).isEqualTo("run-1");
        assertThat(response.status()).isEqualTo("SUCCEEDED");
        assertThat(response.artifacts()).hasSize(1);
        verify(persistenceService).save(any(AgentRun.class), any());
    }

    @Test
    @DisplayName("数据库没有对应智能体配置时返回 404 且不调用 Python")
    void createRunRejectsUnknownAgent() {
        when(agentMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> runService.createRun(
                "missing-agent",
                new AgentRunRequest("测试", null, null, Map.of())
        )).isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));

        verify(runtimeClient, never()).invoke(any(), any());
    }

    @Test
    @DisplayName("Python 运行时不可用时保存失败记录并返回 503")
    void createRunPersistsFailureWhenRuntimeUnavailable() {
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());
        FeignException exception = mock(FeignException.class);
        when(exception.status()).thenReturn(503);
        when(runtimeClient.invoke(eq("demo-chart"), any())).thenThrow(exception);

        assertThatThrownBy(() -> runService.createRun(
                "demo-chart",
                new AgentRunRequest("测试", null, null, Map.of())
        )).isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));

        ArgumentCaptor<AgentRun> runCaptor = ArgumentCaptor.forClass(AgentRun.class);
        verify(persistenceService).save(runCaptor.capture(), eq(List.of()));
        assertThat(runCaptor.getValue().getStatus()).isEqualTo("FAILED");
        assertThat(runCaptor.getValue().getErrorCode()).isEqualTo("RUNTIME_HTTP_503");
        assertThat(runCaptor.getValue().getUserId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("异步运行先保存 PENDING 记录再发布 RabbitMQ 消息")
    void createAsyncRunPersistsAndPublishesTask() {
        rabbitProperties.setEnabled(true);
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());

        AgentRunResponse response = runService.createRun(
                "demo-chart",
                new AgentRunRequest("生成图表", "session-2", "ASYNC", Map.of("week", 1))
        );

        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.executionMode()).isEqualTo("ASYNC");
        ArgumentCaptor<AgentRunTaskMessage> messageCaptor =
                ArgumentCaptor.forClass(AgentRunTaskMessage.class);
        verify(taskPublisher).publish(messageCaptor.capture());
        assertThat(messageCaptor.getValue().runId()).isEqualTo(response.runId());
        assertThat(messageCaptor.getValue().userId()).isEqualTo("42");
        verify(runtimeClient, never()).invoke(any(), any());
    }

    @Test
    @DisplayName("RabbitMQ 未启用时拒绝异步运行")
    void createAsyncRunRequiresRabbitMq() {
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());

        assertThatThrownBy(() -> runService.createRun(
                "demo-chart",
                new AgentRunRequest("生成图表", null, "ASYNC", Map.of())
        )).isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));

        verify(persistenceService, never()).save(any(), any());
        verify(taskPublisher, never()).publish(any());
    }

    @Test
    @DisplayName("运行列表使用当前用户作为数据范围并正确计算下一页")
    void listRunsUsesCurrentUserScope() {
        when(runMapper.findVisiblePage(42L, false, 0L, 3))
                .thenReturn(List.of(run("run-3"), run("run-2"), run("run-1")));

        AgentRunPageResponse response = runService.listRuns(1, 2);

        assertThat(response.hasNext()).isTrue();
        assertThat(response.items()).extracting(item -> item.runId())
                .containsExactly("run-3", "run-2");
        assertThat(response.items()).extracting(item -> item.executionMode())
                .containsOnly("SYNC");
    }

    @Test
    @DisplayName("查询不到当前用户可见的运行记录时返回 404")
    void getRunHidesOtherUsersData() {
        when(runMapper.findVisibleByRunId("run-other", 42L, false)).thenReturn(null);

        assertThatThrownBy(() -> runService.getRun("run-other"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    private TeachingAgent enabledAgent() {
        TeachingAgent agent = new TeachingAgent();
        agent.setCode("demo-chart");
        agent.setStatus("ENABLED");
        return agent;
    }

    @Test
    @DisplayName("重试失败异步任务生成新编号，并使用当前 JWT 身份")
    void retryCreatesNewRun() {
        rabbitProperties.setEnabled(true);
        AgentRun failed = run("old-run");
        failed.setExecutionMode("ASYNC");
        failed.setStatus("FAILED");
        failed.setInputText("retry input");
        failed.setInputContext("{\"grade\":8}");
        when(runMapper.findVisibleByRunId("old-run", 42L, false)).thenReturn(failed);
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());
        AgentRunResponse retried = runService.retryRun("old-run");
        assertThat(retried.runId()).isNotEqualTo("old-run");
        assertThat(retried.status()).isEqualTo("PENDING");
        assertThat(retried.userId()).isEqualTo(42L);
        assertThat(failed.getStatus()).isEqualTo("FAILED");
        verify(taskPublisher).publish(any());
    }

    @Test
    @DisplayName("运行中任务不允许重试，其他用户的任务统一返回 404")
    void retryRejectsActiveOrInvisibleRun() {
        AgentRun active = run("run-1");
        active.setExecutionMode("ASYNC");
        active.setStatus("RUNNING");
        when(runMapper.findVisibleByRunId("run-1", 42L, false)).thenReturn(active);
        assertThatThrownBy(() -> runService.retryRun("run-1"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> runService.retryRun("other"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(taskPublisher, never()).publish(any());
    }

    @Test
    @DisplayName("代码执行任务不能从普通智能体重试入口重新提交")
    void retryRejectsCodeExecutionRun() {
        AgentRun failed = run("code-run-1");
        failed.setAgentCode("code-tutor");
        failed.setExecutionMode("ASYNC");
        failed.setStatus("FAILED");
        when(runMapper.findVisibleByRunId("code-run-1", 42L, false)).thenReturn(failed);

        assertThatThrownBy(() -> runService.retryRun("code-run-1"))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(error.getReason()).contains("代码执行接口");
                });
        verify(taskPublisher, never()).publish(any());
    }

    @Test
    @DisplayName("确认超时仍返回原任务编号，不触发误判失败与重复投递")
    void unconfirmedPublishRemainsPending() {
        rabbitProperties.setEnabled(true);
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());
        org.mockito.Mockito.doThrow(new com.k12.platform.agent.messaging.AgentPublishUnconfirmedException("timeout", null))
                .when(taskPublisher).publish(any());
        AgentRunResponse result = runService.createRun("demo-chart",
                new AgentRunRequest("test", null, "ASYNC", Map.of()));
        assertThat(result.status()).isEqualTo("PENDING");
        verify(persistenceService, never()).markDispatchFailed(any());
    }

    @Test
    @DisplayName("同步返回无效状态时保存失败审计记录")
    void invalidRuntimeResponseIsAudited() {
        when(agentMapper.selectOne(any())).thenReturn(enabledAgent());
        when(runtimeClient.invoke(any(), any())).thenReturn(ApiResponse.ok(
                new RuntimeAgentRunResponse("r", "demo-chart", null, "bad", List.of(), null)));
        assertThatThrownBy(() -> runService.createRun("demo-chart", new AgentRunRequest("test", null, "SYNC", Map.of())))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        ArgumentCaptor<AgentRun> captor = ArgumentCaptor.forClass(AgentRun.class);
        verify(persistenceService).save(captor.capture(), eq(List.of()));
        assertThat(captor.getValue().getErrorCode()).isEqualTo("RUNTIME_INVALID_RESPONSE");
    }

    private AgentRun run(String runId) {
        AgentRun run = new AgentRun();
        run.setRunId(runId);
        run.setAgentCode("demo-chart");
        run.setUserId(42L);
        run.setExecutionMode("SYNC");
        run.setStatus("SUCCEEDED");
        run.setCreatedTime(Instant.now());
        return run;
    }

    private void authenticate(Long userId, String... authorities) {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("student001")
                .claim("userId", userId.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
        List<SimpleGrantedAuthority> grantedAuthorities = List.of(authorities).stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, grantedAuthorities)
        );
    }
}
