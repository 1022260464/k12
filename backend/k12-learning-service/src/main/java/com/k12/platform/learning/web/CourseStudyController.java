package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.*;
import com.k12.platform.learning.service.CourseStudyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Validated
@RestController
@RequestMapping("/api/v1/learning/courses/{courseId}")
public class CourseStudyController {
    private final CourseStudyService service;

    public CourseStudyController(CourseStudyService service) { this.service = service; }

    @PutMapping("/enrollment")
    public ApiResponse<EnrollmentResponse> enroll(@PathVariable("courseId") @Positive Long courseId) {
        return ApiResponse.ok(service.enroll(courseId));
    }

    @GetMapping("/enrollment")
    public ApiResponse<EnrollmentResponse> enrollment(@PathVariable("courseId") @Positive Long courseId) {
        return ApiResponse.ok(service.enrollment(courseId));
    }

    @DeleteMapping("/enrollment")
    public ApiResponse<Void> withdraw(@PathVariable("courseId") @Positive Long courseId) {
        service.withdraw(courseId);
        return ApiResponse.ok(null);
    }

    @PutMapping("/chapters/{chapterId}/progress")
    public ApiResponse<ChapterProgressResponse> updateProgress(@PathVariable("courseId") @Positive Long courseId,
            @PathVariable("chapterId") @Positive Long chapterId, @Valid @RequestBody ProgressRequest request) {
        return ApiResponse.ok(service.updateProgress(courseId, chapterId, request.progressPercent()));
    }

    @GetMapping("/progress")
    public ApiResponse<CourseProgressResponse> progress(@PathVariable("courseId") @Positive Long courseId) {
        return ApiResponse.ok(service.progress(courseId));
    }
}
