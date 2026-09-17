package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.LearningProfileRequest;
import com.k12.platform.iam.dto.LearningProfileResponse;
import com.k12.platform.iam.service.LearningProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/users/me/learning-profile")
public class LearningProfileController {

    private final LearningProfileService learningProfileService;

    public LearningProfileController(LearningProfileService learningProfileService) {
        this.learningProfileService = learningProfileService;
    }

    @GetMapping
    public ApiResponse<LearningProfileResponse> getCurrentProfile() {
        return ApiResponse.ok(learningProfileService.getCurrentProfile());
    }

    @PutMapping
    public ApiResponse<LearningProfileResponse> saveCurrentProfile(
            @Valid @RequestBody LearningProfileRequest request
    ) {
        return ApiResponse.ok(learningProfileService.saveCurrentProfile(request));
    }
}
