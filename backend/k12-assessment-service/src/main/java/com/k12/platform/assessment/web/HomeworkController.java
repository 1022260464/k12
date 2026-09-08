package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.HomeworkRequest;
import com.k12.platform.assessment.dto.HomeworkResponse;
import com.k12.platform.assessment.dto.*;
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
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assessments/homeworks")
public class HomeworkController {

    private final HomeworkService homeworkService;

    public HomeworkController(HomeworkService homeworkService) {
        this.homeworkService = homeworkService;
    }

    @GetMapping
    public ApiResponse<List<HomeworkResponse>> listHomeworks(
            @RequestParam(name = "page", defaultValue = "1") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(homeworkService.listHomeworks(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<HomeworkResponse>> getHomework(@PathVariable("id") Long id) {
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
            @PathVariable("id") Long id,
            @Valid @RequestBody HomeworkRequest request
    ) {
        return homeworkService.updateHomework(id, request)
                .map(homework -> ResponseEntity.ok(ApiResponse.ok(homework)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "Homework not found")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHomework(@PathVariable("id") Long id) {
        if (!homeworkService.deleteHomework(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.fail(404, "Homework not found"));
        }
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/{id}/recipients")
    public ApiResponse<List<Long>> recipients(@PathVariable("id") Long id) {
        return ApiResponse.ok(homeworkService.getRecipients(id));
    }

    @PutMapping("/{id}/recipients")
    public ApiResponse<List<Long>> recipients(@PathVariable("id") Long id,
            @Valid @RequestBody HomeworkRecipientsRequest request) {
        return ApiResponse.ok(homeworkService.setRecipients(id, request));
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<HomeworkResponse> publish(@PathVariable("id") Long id) {
        return ApiResponse.ok(homeworkService.publish(id));
    }

    @PostMapping("/{id}/close")
    public ApiResponse<HomeworkResponse> close(@PathVariable("id") Long id) {
        return ApiResponse.ok(homeworkService.close(id));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<HomeworkSubmissionResponse>> submitHomework(
            @PathVariable("id") Long id, @Valid @RequestBody HomeworkSubmitRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(homeworkService.submitHomework(id, request)));
    }

    @PostMapping("/{id}/grade")
    public ApiResponse<HomeworkSubmissionResponse> gradeHomework(
            @PathVariable("id") Long id, @Valid @RequestBody HomeworkGradeRequest request) {
        return ApiResponse.ok(homeworkService.gradeHomework(id, request));
    }

    @GetMapping("/{id}/submissions/me")
    public ApiResponse<HomeworkSubmissionResponse> mySubmission(@PathVariable("id") Long id) {
        return ApiResponse.ok(homeworkService.mySubmission(id));
    }

    @GetMapping("/{id}/submissions")
    public ApiResponse<SubmissionPageResponse> submissions(@PathVariable("id") Long id,
            @RequestParam(name = "page", defaultValue = "1") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(homeworkService.listSubmissions(id, page, size));
    }

    @GetMapping("/learning-results/me")
    public ApiResponse<SubmissionPageResponse> learningResults(
            @RequestParam(name = "page", defaultValue = "1") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(homeworkService.myLearningResults(page, size));
    }

    @GetMapping("/{id}/submissions/{studentId}/grade-history")
    public ApiResponse<List<HomeworkGradeHistoryResponse>> gradeHistory(
            @PathVariable("id") Long id, @PathVariable("studentId") Long studentId) {
        return ApiResponse.ok(homeworkService.gradeHistory(id, studentId));
    }
}
