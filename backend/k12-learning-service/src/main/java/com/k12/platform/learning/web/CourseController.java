package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.ContentImageResponse;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.CoursePageResponse;
import com.k12.platform.learning.dto.PersonalizedCourseRequest;
import com.k12.platform.learning.dto.PersonalizedCourseResponse;
import org.springframework.web.bind.annotation.RequestParam;
import jakarta.validation.constraints.Size;
import com.k12.platform.learning.service.CourseService;
import com.k12.platform.learning.service.CoursePublicationService;
import com.k12.platform.learning.service.CourseImportService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
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
    private final CoursePublicationService publicationService;
    private final CourseImportService importService;

    public CourseController(CourseService courseService, CoursePublicationService publicationService,
                            CourseImportService importService) {
        this.courseService = courseService;
        this.publicationService = publicationService;
        this.importService = importService;
    }

    @GetMapping
    public ApiResponse<List<CourseResponse>> listCourses() {
        return ApiResponse.ok(courseService.listCourses());
    }

    /** 首页推荐：已发布课程，后端可 Redis 缓存整表结果。 */
    @GetMapping("/recommended")
    public ApiResponse<List<CourseResponse>> recommended(
            @RequestParam(name = "limit", defaultValue = "8") int limit
    ) {
        return ApiResponse.ok(courseService.listRecommendedCourses(limit));
    }

    @PostMapping("/personalized")
    public ApiResponse<List<PersonalizedCourseResponse>> personalized(
            @Valid @RequestBody PersonalizedCourseRequest request) {
        return ApiResponse.ok(courseService.personalized(request));
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

    @PostMapping("/{id}/publish")
    public ApiResponse<Void> publish(@PathVariable("id") @Positive Long id) {
        publicationService.publish(id);
        return ApiResponse.ok(null);
    }

    @PostMapping(path = "/{id}/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<CourseResponse> uploadCover(
            @PathVariable("id") @Positive Long id,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(courseService.uploadCover(id, file));
    }

    @PostMapping(path = "/{id}/content-images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ContentImageResponse> uploadContentImage(
            @PathVariable("id") @Positive Long id,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(courseService.uploadContentImage(id, file));
    }

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<List<CourseResponse>>> importBatch(@RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(importService.importBatch(file)));
    }
}
