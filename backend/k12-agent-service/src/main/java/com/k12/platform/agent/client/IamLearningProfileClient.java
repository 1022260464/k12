package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.LearnerProfileResponse;
import com.k12.platform.agent.config.DownstreamBearerFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

/** 读取当前登录学生在 IAM 中维护的学段、教材和兴趣。 */
@FeignClient(
        name = "k12-iam-service",
        url = "${k12.clients.iam-url:http://127.0.0.1:8081}",
        configuration = DownstreamBearerFeignConfiguration.class
)
public interface IamLearningProfileClient {

    @GetMapping("/api/v1/iam/users/me/learning-profile")
    ApiResponse<LearnerProfileResponse> getCurrentProfile();
}
