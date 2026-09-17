package com.k12.platform.agent.client;

import com.k12.platform.agent.client.dto.LearningResultPageResponse;
import com.k12.platform.agent.client.dto.PracticeAttemptSummaryResponse;
import com.k12.platform.agent.client.dto.KnowledgeMasterySummaryResponse;
import com.k12.platform.agent.config.DownstreamBearerFeignConfiguration;
import com.k12.platform.common.api.ApiResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import java.util.List;

/** 读取当前登录学生最近的作业结果，用于生成个性化教学上下文。 */
@FeignClient(
        name = "k12-assessment-service",
        url = "${k12.clients.assessment-url:http://127.0.0.1:8084}",
        configuration = DownstreamBearerFeignConfiguration.class
)
public interface AssessmentLearningResultClient {

    @GetMapping("/api/v1/assessments/homeworks/learning-results/me")
    ApiResponse<LearningResultPageResponse> getCurrentLearningResults(
            @RequestParam("page") int page,
            @RequestParam("size") int size
    );

    @GetMapping("/api/v1/assessments/practice-attempts/me")
    ApiResponse<List<PracticeAttemptSummaryResponse>> getRecentPracticeAttempts(@RequestParam("limit") int limit);

    @GetMapping("/api/v1/assessments/practice-attempts/me/mastery")
    ApiResponse<List<KnowledgeMasterySummaryResponse>> getCurrentKnowledgeMastery();
}
