package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.LearningHistoryResponse;
import com.k12.platform.learning.service.LearningHistoryService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/learning/history")
public class LearningHistoryController {

    private final LearningHistoryService historyService;

    public LearningHistoryController(LearningHistoryService historyService) {
        this.historyService = historyService;
    }

    @GetMapping("/me")
    public ApiResponse<LearningHistoryResponse> currentUserHistory(
            @RequestParam(name = "limit", defaultValue = "5") @Min(1) @Max(20) int limit
    ) {
        return ApiResponse.ok(historyService.currentUserHistory(limit));
    }
}
