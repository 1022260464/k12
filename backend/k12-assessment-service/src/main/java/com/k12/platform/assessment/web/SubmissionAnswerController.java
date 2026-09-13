package com.k12.platform.assessment.web;

import com.k12.platform.assessment.dto.SubmissionAnswerGradeRequest;
import com.k12.platform.assessment.dto.SubmissionDetailResponse;
import com.k12.platform.assessment.service.SubmissionAnswerService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/assessments/homeworks/{homeworkId}/submissions")
public class SubmissionAnswerController {
    private final SubmissionAnswerService service;

    public SubmissionAnswerController(SubmissionAnswerService service) {
        this.service = service;
    }

    @GetMapping("/me/detail")
    public ApiResponse<SubmissionDetailResponse> myDetail(@PathVariable("homeworkId") Long homeworkId) {
        return ApiResponse.ok(service.myDetail(homeworkId));
    }

    @GetMapping("/{studentId}/detail")
    public ApiResponse<SubmissionDetailResponse> studentDetail(@PathVariable("homeworkId") Long homeworkId,
                                                                @PathVariable("studentId") Long studentId) {
        return ApiResponse.ok(service.studentDetail(homeworkId, studentId));
    }

    @PutMapping("/{studentId}/answers/{questionId}/grade")
    public ApiResponse<SubmissionDetailResponse> gradeAnswer(
            @PathVariable("homeworkId") Long homeworkId,
            @PathVariable("studentId") Long studentId,
            @PathVariable("questionId") Long questionId,
            @Valid @RequestBody SubmissionAnswerGradeRequest request) {
        return ApiResponse.ok(service.gradeAnswer(homeworkId, studentId, questionId, request));
    }
}
