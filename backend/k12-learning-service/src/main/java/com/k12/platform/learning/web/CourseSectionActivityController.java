package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.SectionActivityRequest;
import com.k12.platform.learning.dto.SectionActivityResponse;
import com.k12.platform.learning.service.CourseSectionActivityService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/courses/{courseId}/chapters/{chapterId}/sections/{sectionId}/activities")
public class CourseSectionActivityController {
    private final CourseSectionActivityService service;

    public CourseSectionActivityController(CourseSectionActivityService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SectionActivityResponse>> list(
            @PathVariable @Positive Long courseId,
            @PathVariable @Positive Long chapterId,
            @PathVariable @Positive Long sectionId) {
        return ApiResponse.ok(service.list(courseId, chapterId, sectionId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SectionActivityResponse>> create(
            @PathVariable @Positive Long courseId,
            @PathVariable @Positive Long chapterId,
            @PathVariable @Positive Long sectionId,
            @Valid @RequestBody SectionActivityRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok(service.create(courseId, chapterId, sectionId, request)));
    }

    @PutMapping("/{activityId}")
    public ApiResponse<SectionActivityResponse> update(
            @PathVariable @Positive Long courseId,
            @PathVariable @Positive Long chapterId,
            @PathVariable @Positive Long sectionId,
            @PathVariable @Positive Long activityId,
            @Valid @RequestBody SectionActivityRequest request) {
        return ApiResponse.ok(service.update(courseId, chapterId, sectionId, activityId, request));
    }

    @DeleteMapping("/{activityId}")
    public ApiResponse<Void> delete(
            @PathVariable @Positive Long courseId,
            @PathVariable @Positive Long chapterId,
            @PathVariable @Positive Long sectionId,
            @PathVariable @Positive Long activityId) {
        service.delete(courseId, chapterId, sectionId, activityId);
        return ApiResponse.ok(null);
    }
}
