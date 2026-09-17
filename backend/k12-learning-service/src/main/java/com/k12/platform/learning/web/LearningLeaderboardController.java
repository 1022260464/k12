package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.LeaderboardResponse;
import com.k12.platform.learning.service.LearningLeaderboardService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/learning/leaderboard")
public class LearningLeaderboardController {
    private final LearningLeaderboardService service;

    public LearningLeaderboardController(LearningLeaderboardService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<LeaderboardResponse> leaderboard(
            @RequestParam(value = "limit", defaultValue = "10") @Min(1) @Max(100) int limit) {
        return ApiResponse.ok(service.leaderboard(limit));
    }
}
