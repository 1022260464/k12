package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.SectionRequest;
import com.k12.platform.learning.dto.SectionResponse;
import com.k12.platform.learning.dto.SectionSummaryResponse;
import com.k12.platform.learning.service.CourseSectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/courses/{courseId}/chapters/{chapterId}/sections")
public class CourseSectionController {
    private final CourseSectionService service;

    public CourseSectionController(CourseSectionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SectionSummaryResponse>> list(
            @PathVariable("courseId") @Positive Long courseId,
            @PathVariable("chapterId") @Positive Long chapterId) {
        return ApiResponse.ok(service.list(courseId, chapterId));
    }

    @GetMapping("/{sectionId}")
    public ApiResponse<SectionResponse> get(@PathVariable("courseId") @Positive Long courseId,
                                            @PathVariable("chapterId") @Positive Long chapterId,
                                            @PathVariable("sectionId") @Positive Long sectionId) {
        return ApiResponse.ok(service.get(courseId, chapterId, sectionId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SectionResponse>> create(
            @PathVariable("courseId") @Positive Long courseId,
            @PathVariable("chapterId") @Positive Long chapterId,
            @Valid @RequestBody SectionRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok(service.create(courseId, chapterId, request)));
    }

    @PutMapping("/{sectionId}")
    public ApiResponse<SectionResponse> update(@PathVariable("courseId") @Positive Long courseId,
                                               @PathVariable("chapterId") @Positive Long chapterId,
                                               @PathVariable("sectionId") @Positive Long sectionId,
                                               @Valid @RequestBody SectionRequest request) {
        return ApiResponse.ok(service.update(courseId, chapterId, sectionId, request));
    }

    @DeleteMapping("/{sectionId}")
    public ApiResponse<Void> delete(@PathVariable("courseId") @Positive Long courseId,
                                    @PathVariable("chapterId") @Positive Long chapterId,
                                    @PathVariable("sectionId") @Positive Long sectionId) {
        service.delete(courseId, chapterId, sectionId);
        return ApiResponse.ok(null);
    }
}
