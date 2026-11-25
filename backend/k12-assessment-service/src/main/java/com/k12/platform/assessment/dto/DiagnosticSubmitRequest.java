package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 诊断答卷：只带题目与选项选择；答案键在服务端，自报分数无效。 */
public record DiagnosticSubmitRequest(
        @NotBlank @Pattern(regexp = "lower_primary|upper_primary|middle_school|high_school") String stage,
        @NotEmpty @Size(max = 12) List<@Valid Answer> answers,
        @Size(max = 8) List<@Size(max = 24) String> interests
) {
    public record Answer(
            @NotBlank @Size(max = 32) String questionId,
            @NotBlank @Size(max = 8) String optionId
    ) {
    }
}
