package com.k12.platform.agent.web;

import com.k12.platform.agent.dto.AgentRunRequest;
import com.k12.platform.agent.dto.AgentRunResponse;
import com.k12.platform.agent.dto.AgentSessionHistoryResponse;
import com.k12.platform.agent.dto.ArtifactDownloadUrlResponse;
import com.k12.platform.agent.service.AgentArtifactAccessService;
import com.k12.platform.agent.service.AgentRunService;
import com.k12.platform.agent.service.AgentSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AgentRunControllerTest {

    @Mock
    private AgentRunService runService;
    @Mock
    private AgentSessionService sessionService;
    @Mock
    private AgentArtifactAccessService artifactAccessService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(
                new AgentRunController(runService, sessionService, artifactAccessService)
        ).build();
    }

    @Test
    @DisplayName("运行接口能够绑定显式命名的 agentCode 路径变量")
    void createRunBindsAgentCode() throws Exception {
        when(runService.createRun(eq("demo-chart"), any(AgentRunRequest.class)))
                .thenReturn(succeededRun());

        mockMvc.perform(post("/api/v1/agents/{agentCode}/runs", "demo-chart")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "inputText": "生成学习图表",
                                  "executionMode": "SYNC",
                                  "context": {"grade": "八年级"}
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.runId").value("run-controller-1"));

        ArgumentCaptor<AgentRunRequest> requestCaptor = ArgumentCaptor.forClass(AgentRunRequest.class);
        verify(runService).createRun(eq("demo-chart"), requestCaptor.capture());
        assertThat(requestCaptor.getValue().inputText()).isEqualTo("生成学习图表");
    }

    @Test
    @DisplayName("会话历史接口绑定智能体编码、会话编号和条数")
    void getSessionHistoryBindsScope() throws Exception {
        when(sessionService.getHistory("teaching-assistant", "web-session-1", 10))
                .thenReturn(new AgentSessionHistoryResponse(
                        "web-session-1", "teaching-assistant", List.of()));

        mockMvc.perform(get("/api/v1/agents/{agentCode}/sessions/{sessionId}/history",
                        "teaching-assistant", "web-session-1")
                        .queryParam("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value("web-session-1"))
                .andExpect(jsonPath("$.data.turns").isArray());

        verify(sessionService).getHistory("teaching-assistant", "web-session-1", 10);
    }

    @Test
    @DisplayName("产物下载接口绑定运行编号和产物编号")
    void createArtifactDownloadUrlBindsIds() throws Exception {
        when(artifactAccessService.createDownloadUrl("run-1", "artifact-1"))
                .thenReturn(new ArtifactDownloadUrlResponse(
                        "artifact-1", "https://storage.example/signed", 300));

        mockMvc.perform(get("/api/v1/agents/runs/{runId}/artifacts/{artifactId}/download-url",
                        "run-1", "artifact-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.artifactId").value("artifact-1"))
                .andExpect(jsonPath("$.data.url").value("https://storage.example/signed"))
                .andExpect(jsonPath("$.data.expiresSeconds").value(300));

        verify(artifactAccessService).createDownloadUrl("run-1", "artifact-1");
    }

    private AgentRunResponse succeededRun() {
        Instant now = Instant.now();
        return new AgentRunResponse(
                "run-controller-1",
                "demo-chart",
                1L,
                null,
                "SYNC",
                "生成学习图表",
                null,
                "SUCCEEDED",
                "完成",
                null,
                null,
                null,
                10L,
                now,
                now,
                now,
                List.of()
        );
    }
}
