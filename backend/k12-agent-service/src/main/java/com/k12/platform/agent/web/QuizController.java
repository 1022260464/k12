package com.k12.platform.agent.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeQuizRequest;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 学生端 AI 组题：按主题/课文即时出一组选择题，无需教师发布。
 * 生成结果不落库，练习记录留在前端会话内。
 */
@Validated
@RestController
@RequestMapping("/api/v1/agents/quiz")
public class QuizController {
    private final AgentRuntimeClient runtimeClient;

    public QuizController(AgentRuntimeClient runtimeClient) {
        this.runtimeClient = runtimeClient;
    }

    @PostMapping("/generate")
    public ApiResponse<JsonNode> generate(@Valid @RequestBody GenerateRequest request) {
        return runtimeClient.generateQuiz(new RuntimeQuizRequest(
                request.topic().trim(),
                request.stage(),
                request.count(),
                request.sourceText()));
    }

    public record GenerateRequest(
            @NotBlank @Size(max = 200) String topic,
            @Size(max = 32) String stage,
            @Min(3) @Max(8) Integer count,
            @Size(max = 4000) String sourceText) {
    }
}
