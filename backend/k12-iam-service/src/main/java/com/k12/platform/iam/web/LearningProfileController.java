package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.LearningProfileRequest;
import com.k12.platform.iam.dto.LearningProfileResponse;
import com.k12.platform.iam.service.LearningProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/iam/users/me/learning-profile")
public class LearningProfileController {
    private final LearningProfileService service;
    public LearningProfileController(LearningProfileService service) { this.service = service; }

    @GetMapping
    public ApiResponse<LearningProfileResponse> getMine() {
        return ApiResponse.ok(service.getMine());
    }

    @PutMapping
    public ApiResponse<LearningProfileResponse> updateMine(@Valid @RequestBody LearningProfileRequest request) {
        return ApiResponse.ok(service.updateMine(request));
    }
}
