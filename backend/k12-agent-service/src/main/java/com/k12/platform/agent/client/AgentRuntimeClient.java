package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.RuntimeAgentInvokeRequest;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionRequest;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.client.dto.RuntimeDownloadUrlResponse;
import com.k12.platform.agent.config.AgentRuntimeFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Python Agent Runtime 的内部 HTTP 契约。
 * 浏览器不能直接调用该地址，所有用户身份和运行记录都由 Java 服务统一管理。
 */
@FeignClient(
        name = "k12-agent-runtime",
        url = "${k12.agent.runtime.base-url:http://127.0.0.1:8090}",
        configuration = AgentRuntimeFeignConfiguration.class
)
public interface AgentRuntimeClient {

    @PostMapping("/internal/v1/agents/{agentCode}/invoke")
    ApiResponse<RuntimeAgentRunResponse> invoke(
            @PathVariable("agentCode") String agentCode,
            @RequestBody RuntimeAgentInvokeRequest request
    );

    /**
     * 调用 Python Runtime 的受控代码沙箱。
     * 这里只声明内部服务契约，不向浏览器直接开放该接口。
     */
    @PostMapping("/internal/v1/sandbox/executions")
    ApiResponse<RuntimeCodeExecutionResponse> executeCode(
            @RequestBody RuntimeCodeExecutionRequest request
    );

    /** 使用内部密钥向 Python Runtime 换取短期有效的 MinIO 下载地址。 */
    @GetMapping("/internal/v1/storage/download-url")
    ApiResponse<RuntimeDownloadUrlResponse> createDownloadUrl(
            @RequestParam("objectKey") String objectKey
    );
}
