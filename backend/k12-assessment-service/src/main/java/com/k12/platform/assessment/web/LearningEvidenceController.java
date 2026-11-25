package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.InternalEvidenceRequest;
import com.k12.platform.assessment.dto.LearningEvidenceResponse;
import com.k12.platform.assessment.service.LearningEvidenceService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/assessments/evidence")
public class LearningEvidenceController {
    private final LearningEvidenceService service;

    public LearningEvidenceController(LearningEvidenceService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public ApiResponse<List<LearningEvidenceResponse>> mine(
            @RequestParam(name = "limit", defaultValue = "30") @Min(1) @Max(50) int limit) {
        return ApiResponse.ok(service.mine(limit));
    }

    /**
     * 服务间写回入口：URL 层 permitAll 放行（无用户态），
     * 真正的鉴权在 Service 内用共享密钥校验，学生 Token 到这里没有意义。
     */
    @PostMapping("/internal")
    public ResponseEntity<ApiResponse<Void>> internal(
            @RequestHeader(name = "X-K12-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody InternalEvidenceRequest request) {
        service.recordInternal(request, internalToken);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(null));
    }
}
