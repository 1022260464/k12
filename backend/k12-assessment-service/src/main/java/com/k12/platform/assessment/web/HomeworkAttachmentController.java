package com.k12.platform.assessment.web;

import com.k12.platform.assessment.service.QuestionAttachmentService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.constraints.Positive;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Validated
@RestController
@RequestMapping("/api/v1/assessments/homeworks/{homeworkId}/attachments")
public class HomeworkAttachmentController {
    private final QuestionAttachmentService service;

    public HomeworkAttachmentController(QuestionAttachmentService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Long>> summary(@PathVariable("homeworkId") @Positive Long homeworkId) {
        return ApiResponse.ok(Map.of(
                "count", service.countByHomework(homeworkId),
                "limit", (long) QuestionAttachmentService.MAX_ATTACHMENTS_PER_HOMEWORK
        ));
    }
}
