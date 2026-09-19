package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.AccountBehaviorResponse;
import com.k12.platform.agent.config.DownstreamBearerFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;

/** 账号级无关提问计数与临时/永久封禁状态。 */
@FeignClient(
        name = "k12-iam-service",
        contextId = "iamAccountBehaviorClient",
        url = "${k12.clients.iam-url:http://127.0.0.1:8081}",
        configuration = DownstreamBearerFeignConfiguration.class
)
public interface IamAccountBehaviorClient {

    @GetMapping("/api/v1/iam/users/me/behavior")
    ApiResponse<AccountBehaviorResponse> getCurrentBehavior();

    @PostMapping("/api/v1/iam/users/me/behavior/off-topic")
    ApiResponse<AccountBehaviorResponse> recordOffTopicStrike();
}
