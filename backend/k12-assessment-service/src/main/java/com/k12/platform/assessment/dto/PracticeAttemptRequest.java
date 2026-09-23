package com.k12.platform.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PracticeAttemptRequest(
        @NotBlank @Size(max = 64) String runId,
        @NotEmpty @Size(max = 10) List<@Valid Answer> answers,
        @Min(0) @Max(20) Integer hintCount,
        @Min(0) @Max(3600000) Long durationMs
) {
    public PracticeAttemptRequest(String runId, List<Answer> answers) {
        this(runId, answers, null, null);
    }

    public record Answer(
            @NotBlank @Size(max = 64) String questionId,
            @NotBlank @Size(max = 64) String optionId
    ) {
    }
}
