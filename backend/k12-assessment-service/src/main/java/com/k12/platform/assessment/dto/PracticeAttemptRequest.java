package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PracticeAttemptRequest(
        @NotBlank @Size(max = 64) String runId,
        @NotEmpty @Size(max = 10) List<@Valid Answer> answers
) {
    public record Answer(
            @NotBlank @Size(max = 64) String questionId,
            @NotBlank @Size(max = 64) String optionId
    ) {
    }
}
