package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.CoursePageResponse;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.constraints.Size;
import com.k12.platform.learning.service.CourseService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/learning/courses")
public class CourseController {

    private final CourseService courseService;

    public CourseController(CourseService courseService) {
        this.courseService = courseService;
    }

    @GetMapping
    public ApiResponse<List<CourseResponse>> listCourses() {
        return ApiResponse.ok(courseService.listCourses());
    }

    @GetMapping("/page")
    public ApiResponse<CoursePageResponse> search(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "keyword", required = false) @Size(max = 128) String keyword,
            @RequestParam(name = "subject", required = false) @Size(max = 64) String subject,
            @RequestParam(name = "gradeLevel", required = false) @Size(max = 32) String gradeLevel,
            @RequestParam(name = "mine", defaultValue = "false") boolean mine
    ) {
        return ApiResponse.ok(courseService.search(page, size, keyword, subject, gradeLevel, mine));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CourseResponse>> getCourse(@PathVariable("id") @Positive Long id) {
        return courseService.getCourse(id)
                .map(course -> ResponseEntity.ok(ApiResponse.ok(course)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "课程不存在")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CourseResponse>> createCourse(@Valid @RequestBody CourseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(courseService.createCourse(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CourseResponse>> updateCourse(
            @PathVariable("id") @Positive Long id,
            @Valid @RequestBody CourseRequest request
    ) {
        return courseService.updateCourse(id, request)
                .map(course -> ResponseEntity.ok(ApiResponse.ok(course)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "课程不存在")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCourse(@PathVariable("id") @Positive Long id) {
        if (!courseService.deleteCourse(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.fail(404, "课程不存在"));
        }
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
