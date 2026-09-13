package com.k12.platform.agent.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
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
}
