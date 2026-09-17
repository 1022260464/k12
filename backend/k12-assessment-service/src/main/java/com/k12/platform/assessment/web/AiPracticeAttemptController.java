package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.PracticeAttemptRequest;
import com.k12.platform.assessment.dto.PracticeAttemptResponse;
import com.k12.platform.assessment.dto.PracticeInsightResponse;
import com.k12.platform.assessment.dto.KnowledgeMasteryResponse;
import com.k12.platform.assessment.service.AiPracticeAttemptService;
import com.k12.platform.assessment.service.PracticeInsightService;
import com.k12.platform.assessment.service.KnowledgeMasteryService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/assessments/practice-attempts")
public class AiPracticeAttemptController {
    private final AiPracticeAttemptService service;
    private final PracticeInsightService insightService;
    private final KnowledgeMasteryService masteryService;

    public AiPracticeAttemptController(AiPracticeAttemptService service, PracticeInsightService insightService,
                                       KnowledgeMasteryService masteryService) {
        this.service = service;
        this.insightService = insightService;
        this.masteryService = masteryService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PracticeAttemptResponse>> submit(@Valid @RequestBody PracticeAttemptRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.submit(request)));
    }

    @GetMapping("/me")
    public ApiResponse<List<PracticeAttemptResponse>> recent(@RequestParam(name = "limit", defaultValue = "5") int limit) {
        return ApiResponse.ok(service.findRecent(limit));
    }

    @GetMapping("/me/insights")
    public ApiResponse<List<PracticeInsightResponse>> insights() {
        return ApiResponse.ok(insightService.myInsights());
    }

    @GetMapping("/me/mastery")
    public ApiResponse<List<KnowledgeMasteryResponse>> mastery() {
        return ApiResponse.ok(masteryService.myMastery());
    }

    @GetMapping("/runs/{runId}/me")
    public ApiResponse<PracticeAttemptResponse> byRun(@PathVariable("runId") @Size(max = 64) String runId) {
        return ApiResponse.ok(service.findByRun(runId));
    }
}
