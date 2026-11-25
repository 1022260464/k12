package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.DiagnosticQuestionResponse;
import com.k12.platform.assessment.dto.DiagnosticResultResponse;
import com.k12.platform.assessment.dto.DiagnosticSubmitRequest;
import com.k12.platform.assessment.service.DiagnosticService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/assessments/diagnostics")
public class DiagnosticController {
    private final DiagnosticService service;

    public DiagnosticController(DiagnosticService service) {
        this.service = service;
    }

    @GetMapping("/paper")
    public ApiResponse<List<DiagnosticQuestionResponse>> paper(
            @RequestParam(name = "stage") @Pattern(regexp = "lower_primary|upper_primary|middle_school|high_school") String stage) {
        return ApiResponse.ok(service.paper(stage));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DiagnosticResultResponse>> submit(@Valid @RequestBody DiagnosticSubmitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.submit(request)));
    }

    @GetMapping("/me")
    public ApiResponse<DiagnosticResultResponse> latest() {
        return ApiResponse.ok(service.latest());
    }
}
