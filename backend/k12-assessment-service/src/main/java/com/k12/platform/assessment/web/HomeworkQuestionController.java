package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.HomeworkQuestionRequest;
import com.k12.platform.assessment.dto.HomeworkQuestionResponse;
import com.k12.platform.assessment.service.HomeworkQuestionService;
import com.k12.platform.assessment.service.QuestionImportService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assessments/homeworks/{homeworkId}/questions")
public class HomeworkQuestionController {
    private final HomeworkQuestionService service;
    private final QuestionImportService importService;

    public HomeworkQuestionController(HomeworkQuestionService service, QuestionImportService importService) {
        this.service = service;
        this.importService = importService;
    }

    @GetMapping
    public ApiResponse<List<HomeworkQuestionResponse>> list(@PathVariable("homeworkId") Long homeworkId) {
        return ApiResponse.ok(service.list(homeworkId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<HomeworkQuestionResponse>> create(
            @PathVariable("homeworkId") Long homeworkId,
            @Valid @RequestBody HomeworkQuestionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.create(homeworkId, request)));
    }

    @PutMapping("/{questionId}")
    public ApiResponse<HomeworkQuestionResponse> update(@PathVariable("homeworkId") Long homeworkId,
                                                        @PathVariable("questionId") Long questionId,
                                                        @Valid @RequestBody HomeworkQuestionRequest request) {
        return ApiResponse.ok(service.update(homeworkId, questionId, request));
    }

    @DeleteMapping("/{questionId}")
    public ApiResponse<Void> delete(@PathVariable("homeworkId") Long homeworkId,
                                    @PathVariable("questionId") Long questionId) {
        service.delete(homeworkId, questionId);
        return ApiResponse.ok(null);
    }

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<List<HomeworkQuestionResponse>>> importBatch(
            @PathVariable("homeworkId") Long homeworkId,
            @RequestPart("file") org.springframework.web.multipart.MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(importService.importBatch(homeworkId, file)));
    }
}
