package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.LearningHistoryResponse;
import com.k12.platform.agent.config.DownstreamBearerFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/** 查询当前学生最近课程进度，供教学 Agent 调整内容和难度。 */
@FeignClient(
        name = "k12-learning-service",
        url = "${k12.clients.learning-url:http://127.0.0.1:8082}",
        configuration = DownstreamBearerFeignConfiguration.class
)
public interface LearningHistoryClient {

    @GetMapping("/api/v1/learning/history/me")
    ApiResponse<LearningHistoryResponse> getCurrentLearningHistory(
            @RequestParam("limit") int limit
    );
}
