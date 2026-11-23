package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.RuntimeConversationSummaryRequest;
import com.k12.platform.agent.client.dto.RuntimeConversationSummaryResponse;
import com.k12.platform.agent.config.AgentRuntimeFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Separate internal client so summary model calls have a shorter timeout. */
@FeignClient(
        name = "k12-agent-runtime-summary",
        url = "${k12.agent.runtime.base-url:http://127.0.0.1:8090}",
        configuration = AgentRuntimeFeignConfiguration.class
)
public interface AgentRuntimeSummaryClient {

    @PostMapping("/internal/v1/knowledge/summarize-conversation")
    ApiResponse<RuntimeConversationSummaryResponse> summarize(
            @RequestBody RuntimeConversationSummaryRequest request
    );
}
