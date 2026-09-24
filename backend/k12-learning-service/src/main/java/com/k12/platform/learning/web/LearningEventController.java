package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.LearningEventListResponse;
import com.k12.platform.learning.service.LearningEventService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/learning/events")
public class LearningEventController {
    private final LearningEventService eventService;

    public LearningEventController(LearningEventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping("/me")
    public ApiResponse<LearningEventListResponse> mine(
            @RequestParam(name = "days", defaultValue = "30") @Min(1) @Max(90) int days,
            @RequestParam(name = "limit", defaultValue = "100") @Min(1) @Max(200) int limit
    ) {
        return ApiResponse.ok(eventService.currentUserEvents(days, limit));
    }
}
