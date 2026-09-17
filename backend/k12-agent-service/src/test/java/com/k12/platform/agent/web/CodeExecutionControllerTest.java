package com.k12.platform.agent.web;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.service.CodeExecutionService;
import com.k12.platform.agent.service.CodeExecutionOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CodeExecutionControllerTest {

    @Mock
    private CodeExecutionService executionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new CodeExecutionController(executionService))
                .setControllerAdvice(new AgentExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("代码执行接口返回标准输出和公开产物")
    void executeReturnsPublicResponse() throws Exception {
        var payload = JsonNodeFactory.instance.objectNode().put("language", "python");
        when(executionService.execute(eq("print('hello')"), eq(8), org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(new CodeExecutionOutcome("run-1", new RuntimeCodeExecutionResponse(
                        "exec-1",
                        "SUCCEEDED",
                        "hello\n",
                        "",
                        List.of(new RuntimeArtifactResponse(
                                "artifact-1",
                                "CODE_RESULT",
                                "text/plain",
                                "执行结果",
                                null,
                                payload
                        )),
                        0,
                        120L,
                        "provider-secret-id"
                )));

        mockMvc.perform(post("/api/v1/agents/code-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "print('hello')",
                                  "timeoutSeconds": 8
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.runId").value("run-1"))
                .andExpect(jsonPath("$.data.executionId").value("exec-1"))
                .andExpect(jsonPath("$.data.stdout").value("hello\n"))
                .andExpect(jsonPath("$.data.artifacts[0].kind").value("CODE_RESULT"))
                .andExpect(jsonPath("$.data.providerRequestId").doesNotExist());
    }

    @Test
    @DisplayName("未填写超时时间时交给Service使用默认值")
    void missingTimeoutUsesServiceDefault() throws Exception {
        when(executionService.execute(eq("print(1)"), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(new CodeExecutionOutcome("run-2", new RuntimeCodeExecutionResponse(
                        "exec-2", "SUCCEEDED", "1\n", "", List.of(), 0, 20L, null
                )));

        mockMvc.perform(post("/api/v1/agents/code-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"print(1)\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<Integer> timeoutCaptor = ArgumentCaptor.forClass(Integer.class);
        verify(executionService).execute(eq("print(1)"), timeoutCaptor.capture(),
                org.mockito.ArgumentMatchers.isNull());
        assertThat(timeoutCaptor.getValue()).isNull();
    }

    @Test
    @DisplayName("异步代码执行返回202和可轮询的runId")
    void asyncExecutionReturnsAccepted() throws Exception {
        when(executionService.execute(eq("print(1)"), eq(10), eq("ASYNC")))
                .thenReturn(new CodeExecutionOutcome("run-async-1", new RuntimeCodeExecutionResponse(
                        null, "PENDING", "", "", List.of(), null, null, null
                )));

        mockMvc.perform(post("/api/v1/agents/code-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"print(1)\",\"timeoutSeconds\":10,\"executionMode\":\"ASYNC\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.runId").value("run-async-1"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    @DisplayName("日配额耗尽时返回标准429响应")
    void quotaExceededReturnsTooManyRequests() throws Exception {
        when(executionService.execute(eq("print(1)"), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull()))
                .thenThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "今日代码运行次数已用完"));

        mockMvc.perform(post("/api/v1/agents/code-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"print(1)\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.message").value("今日代码运行次数已用完"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("空代码和超出范围的超时返回400")
    void invalidRequestReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/agents/code-executions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"   \",\"timeoutSeconds\":31}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }
}
