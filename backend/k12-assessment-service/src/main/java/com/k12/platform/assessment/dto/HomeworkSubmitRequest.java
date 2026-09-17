package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record HomeworkSubmitRequest(
        @Size(max = 5000) String answerContent,
        @Valid @Size(max = 200) List<SubmissionAnswerRequest> answers
) {
    /** 保留旧调用方式，已有 Java 测试和客户端不用立即重写。 */
    public HomeworkSubmitRequest(String answerContent) {
        this(answerContent, List.of());
    }
}
