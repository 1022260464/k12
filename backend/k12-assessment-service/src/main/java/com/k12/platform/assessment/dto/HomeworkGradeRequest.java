package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record HomeworkGradeRequest(
        @NotNull @Positive Long studentUserId,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal score,
        @Size(max = 2000) String feedback,
        @PositiveOrZero Integer expectedVersion
) {}
