package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.RuntimeAgentInvokeRequest;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
import com.k12.platform.agent.config.AgentRuntimeFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

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
}
