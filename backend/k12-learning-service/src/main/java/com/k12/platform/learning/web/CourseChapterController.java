package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.ChapterRequest;
import com.k12.platform.learning.dto.ChapterResponse;
import com.k12.platform.learning.dto.ChapterSummaryResponse;
import com.k12.platform.learning.service.CourseChapterService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/courses/{courseId}/chapters")
public class CourseChapterController {
    private final CourseChapterService service;

    public CourseChapterController(CourseChapterService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<ChapterSummaryResponse>> list(@PathVariable("courseId") @Positive Long courseId) {
        return ApiResponse.ok(service.list(courseId));
    }

    @GetMapping("/{chapterId}")
    public ApiResponse<ChapterResponse> get(@PathVariable("courseId") @Positive Long courseId,
                                          @PathVariable("chapterId") @Positive Long chapterId) {
        return ApiResponse.ok(service.get(courseId, chapterId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ChapterResponse>> create(
            @PathVariable("courseId") @Positive Long courseId, @Valid @RequestBody ChapterRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok(service.create(courseId, request)));
    }

    @PutMapping("/{chapterId}")
    public ApiResponse<ChapterResponse> update(@PathVariable("courseId") @Positive Long courseId,
            @PathVariable("chapterId") @Positive Long chapterId, @Valid @RequestBody ChapterRequest request) {
        return ApiResponse.ok(service.update(courseId, chapterId, request));
    }

    @DeleteMapping("/{chapterId}")
    public ApiResponse<Void> delete(@PathVariable("courseId") @Positive Long courseId,
                                  @PathVariable("chapterId") @Positive Long chapterId) {
        service.delete(courseId, chapterId);
        return ApiResponse.ok(null);
    }
}
