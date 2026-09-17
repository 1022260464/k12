package com.k12.platform.agent.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionRequest;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.client.dto.RuntimeDownloadUrlResponse;
import com.k12.platform.common.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** 验证 Python Runtime 的 camelCase JSON 能被 Java Feign 返回类型正确读取。 */
class AgentRuntimeContractTest {

    @Test
    @DisplayName("Java 可以反序列化 Python Runtime 的运行结果和产物")
    void deserializePythonRuntimeResponse() throws Exception {
        String json = """
                {
                  "code": 200,
                  "message": "ok",
                  "data": {
                    "runId": "run-contract-1",
                    "agentCode": "demo-chart",
                    "status": "SUCCEEDED",
                    "outputText": "图表生成完成",
                    "artifacts": [
                      {
                        "artifactId": "artifact-1",
                        "kind": "CHART",
                        "mimeType": "application/vnd.vegalite+json",
                        "title": "示例图表",
                        "uri": null,
                        "payload": {"mark": "bar"}
                      }
                    ],
                    "metadata": {"model": "demo"}
                  }
                }
                """;
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

        ApiResponse<RuntimeAgentRunResponse> response = objectMapper.readValue(
                json,
                new TypeReference<>() {
                }
        );

        assertThat(response.code()).isEqualTo(200);
        assertThat(response.timestamp()).isNull();
        assertThat(response.data().runId()).isEqualTo("run-contract-1");
        assertThat(response.data().artifacts()).singleElement()
                .satisfies(artifact -> {
                    assertThat(artifact.kind()).isEqualTo("CHART");
                    assertThat(artifact.payload().get("mark").asText()).isEqualTo("bar");
                });
    }

    @Test
    @DisplayName("Java 可以序列化 Python 沙箱请求")
    void serializeSandboxExecutionRequest() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        RuntimeCodeExecutionRequest request = RuntimeCodeExecutionRequest.of(
                "print('hello k12')",
                10
        );

        String json = objectMapper.writeValueAsString(request);

        assertThat(json).contains("\"code\":\"print('hello k12')\"");
        assertThat(json).contains("\"timeoutSeconds\":10");
        assertThat(json).contains("\"packages\":[]");
    }

    @Test
    @DisplayName("Java 可以反序列化 Python 沙箱执行结果")
    void deserializeSandboxExecutionResponse() throws Exception {
        String json = """
                {
                  "code": 200,
                  "message": "ok",
                  "data": {
                    "executionId": "exec-contract-1",
                    "status": "SUCCEEDED",
                    "stdout": "hello k12\\n",
                    "stderr": "",
                    "artifacts": [
                      {
                        "artifactId": "artifact-code-1",
                        "kind": "CODE_RESULT",
                        "mimeType": "text/plain",
                        "title": "Python执行结果",
                        "uri": null,
                        "payload": {"language": "python"}
                      }
                    ],
                    "exitCode": 0,
                    "durationMs": 125,
                    "providerRequestId": "provider-1"
                  }
                }
                """;
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

        ApiResponse<RuntimeCodeExecutionResponse> response = objectMapper.readValue(
                json,
                new TypeReference<>() {
                }
        );

        assertThat(response.code()).isEqualTo(200);
        assertThat(response.data().executionId()).isEqualTo("exec-contract-1");
        assertThat(response.data().status()).isEqualTo("SUCCEEDED");
        assertThat(response.data().stdout()).isEqualTo("hello k12\n");
        assertThat(response.data().exitCode()).isZero();
        assertThat(response.data().artifacts()).singleElement()
                .satisfies(artifact -> assertThat(artifact.kind()).isEqualTo("CODE_RESULT"));
    }

    @Test
    @DisplayName("Java 可以反序列化 Python 对象存储临时地址")
    void deserializeDownloadUrlResponse() throws Exception {
        String json = """
                {
                  "code": 200,
                  "message": "ok",
                  "data": {
                    "objectKey": "code/plot.png",
                    "url": "https://storage.example/plot.png?signature=1",
                    "expiresSeconds": 300
                  }
                }
                """;

        ObjectMapper objectMapper = new ObjectMapper();
        ApiResponse<RuntimeDownloadUrlResponse> response = objectMapper.readValue(
                json, new TypeReference<>() { });

        assertThat(response.data().objectKey()).isEqualTo("code/plot.png");
        assertThat(response.data().expiresSeconds()).isEqualTo(300);
    }
}
