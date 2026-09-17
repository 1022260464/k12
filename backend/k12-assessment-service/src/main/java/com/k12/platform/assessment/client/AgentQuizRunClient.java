package com.k12.platform.assessment.client;

import com.k12.platform.assessment.config.IamFeignConfiguration;
import com.k12.platform.assessment.dto.AgentQuizRunResponse;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

/** 使用当前学生的 Bearer Token 读取其已完成的教学运行，不能由前端提供正确答案。 */
@FeignClient(
        name = "k12-agent-service",
        url = "${k12.clients.agent-url:http://127.0.0.1:8083}",
        configuration = IamFeignConfiguration.class
)
public interface AgentQuizRunClient {

    @GetMapping("/api/v1/agents/runs/{runId}")
    ApiResponse<AgentQuizRunResponse> getRun(@PathVariable("runId") String runId);
}
