package com.k12.platform.iam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/* record 只承载接口输入，业务合法性仍由 LearningProfileService 校验。 */
public record LearningProfileRequest(
        @NotBlank String schoolStage,
        @NotNull @Min(1) @Max(12) Integer grade,
        @Size(max = 128) String textbook,
        @Valid @Size(max = 10) List<@NotBlank @Size(max = 40) String> interests
) {
}
