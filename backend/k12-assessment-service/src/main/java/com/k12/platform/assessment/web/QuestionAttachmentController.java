package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.QuestionAttachmentResponse;
import com.k12.platform.assessment.service.QuestionAttachmentService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/v1/assessments/homeworks/{homeworkId}/questions/{questionId}/attachments")
public class QuestionAttachmentController {
    private final QuestionAttachmentService service;

    public QuestionAttachmentController(QuestionAttachmentService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<QuestionAttachmentResponse>> list(
            @PathVariable("homeworkId") @Positive Long homeworkId,
            @PathVariable("questionId") @Positive Long questionId) {
        return ApiResponse.ok(service.list(homeworkId, questionId));
    }

    @GetMapping("/{attachmentId}/download-url")
    public ApiResponse<Map<String, String>> download(
            @PathVariable("homeworkId") @Positive Long homeworkId,
            @PathVariable("questionId") @Positive Long questionId,
            @PathVariable("attachmentId") @Positive Long attachmentId) {
        return ApiResponse.ok(Map.of("url", service.downloadUrl(homeworkId, questionId, attachmentId)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<QuestionAttachmentResponse>> upload(
            @PathVariable("homeworkId") @Positive Long homeworkId,
            @PathVariable("questionId") @Positive Long questionId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.upload(homeworkId, questionId, file)));
    }

    @DeleteMapping("/{attachmentId}")
    public ApiResponse<Void> delete(@PathVariable("homeworkId") @Positive Long homeworkId,
                                    @PathVariable("questionId") @Positive Long questionId,
                                    @PathVariable("attachmentId") @Positive Long attachmentId) {
        service.delete(homeworkId, questionId, attachmentId);
        return ApiResponse.ok(null);
    }
}
