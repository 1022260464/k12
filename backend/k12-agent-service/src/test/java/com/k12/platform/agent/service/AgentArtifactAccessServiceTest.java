package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeDownloadUrlResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.api.ApiResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentArtifactAccessServiceTest {

    @Mock AgentRunMapper runMapper;
    @Mock AgentArtifactMapper artifactMapper;
    @Mock AgentRuntimeClient runtimeClient;

    private AgentArtifactAccessService service;

    @BeforeEach
    void setUp() {
        service = new AgentArtifactAccessService(runMapper, artifactMapper, runtimeClient);
        Jwt jwt = Jwt.withTokenValue("test").header("alg", "none").subject("student")
                .claim("userId", "42").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority("agent:read"))));
    }

    @AfterEach
    void clearIdentity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("校验运行归属后为对象存储产物生成临时地址")
    void createsDownloadUrlForVisibleArtifact() {
        when(runMapper.findVisibleByRunId("run-1", 42L, false)).thenReturn(run("run-1"));
        when(artifactMapper.selectOne(any())).thenReturn(artifact("s3://k12-artifacts/code/plot.png"));
        when(runtimeClient.createDownloadUrl("code/plot.png")).thenReturn(ApiResponse.ok(
                new RuntimeDownloadUrlResponse(
                        "code/plot.png", "https://storage.example/k12-artifacts/code/plot.png?signature=1", 300)));

        var response = service.createDownloadUrl("run-1", "artifact-1");

        assertThat(response.artifactId()).isEqualTo("artifact-1");
        assertThat(response.url()).startsWith("https://storage.example/");
        assertThat(response.expiresSeconds()).isEqualTo(300);
        verify(runMapper).findVisibleByRunId("run-1", 42L, false);
        verify(runtimeClient).createDownloadUrl("code/plot.png");
    }

    @Test
    @DisplayName("无权查看的运行统一按不存在处理")
    void hidesInvisibleRun() {
        when(runMapper.findVisibleByRunId("run-other", 42L, false)).thenReturn(null);

        assertThatThrownBy(() -> service.createDownloadUrl("run-other", "artifact-1"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404 NOT_FOUND");
        verify(artifactMapper, never()).selectOne(any());
        verify(runtimeClient, never()).createDownloadUrl(any());
    }

    @Test
    @DisplayName("内嵌产物不能伪装成对象存储文件")
    void rejectsArtifactWithoutObjectStorageUri() {
        when(runMapper.findVisibleByRunId("run-1", 42L, false)).thenReturn(run("run-1"));
        when(artifactMapper.selectOne(any())).thenReturn(artifact(null));

        assertThatThrownBy(() -> service.createDownloadUrl("run-1", "artifact-1"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
        verify(runtimeClient, never()).createDownloadUrl(any());
    }

    @Test
    @DisplayName("拒绝 Python Runtime 返回非 HTTP 临时地址")
    void rejectsUnsafeRuntimeUrl() {
        when(runMapper.findVisibleByRunId("run-1", 42L, false)).thenReturn(run("run-1"));
        when(artifactMapper.selectOne(any())).thenReturn(artifact("s3://k12-artifacts/code/result.txt"));
        when(runtimeClient.createDownloadUrl("code/result.txt")).thenReturn(ApiResponse.ok(
                new RuntimeDownloadUrlResponse("code/result.txt", "javascript:alert(1)", 300)));

        assertThatThrownBy(() -> service.createDownloadUrl("run-1", "artifact-1"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("502 BAD_GATEWAY");
    }

    private AgentRun run(String runId) {
        AgentRun run = new AgentRun();
        run.setRunId(runId);
        run.setUserId(42L);
        return run;
    }

    private AgentArtifact artifact(String storageUri) {
        AgentArtifact artifact = new AgentArtifact();
        artifact.setArtifactId("artifact-1");
        artifact.setRunId("run-1");
        artifact.setStorageUri(storageUri);
        return artifact;
    }
}
