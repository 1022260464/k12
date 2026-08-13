package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.service.HomeworkService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
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

import java.util.List;

@RestController
@RequestMapping("/api/v1/assessments/homeworks")
public class HomeworkController {

    private final HomeworkService homeworkService;

    public HomeworkController(HomeworkService homeworkService) {
        this.homeworkService = homeworkService;
    }

    @GetMapping
    public ApiResponse<List<HomeworkResponse>> listHomeworks() {
        return ApiResponse.ok(homeworkService.listHomeworks());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<HomeworkResponse>> getHomework(@PathVariable Long id) {
        return homeworkService.getHomework(id)
                .map(homework -> ResponseEntity.ok(ApiResponse.ok(homework)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "Homework not found")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<HomeworkResponse>> createHomework(@Valid @RequestBody HomeworkRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(homeworkService.createHomework(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<HomeworkResponse>> updateHomework(
            @PathVariable Long id,
            @Valid @RequestBody HomeworkRequest request
    ) {
        return homeworkService.updateHomework(id, request)
                .map(homework -> ResponseEntity.ok(ApiResponse.ok(homework)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "Homework not found")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHomework(@PathVariable Long id) {
        if (!homeworkService.deleteHomework(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.fail(404, "Homework not found"));
        }
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
