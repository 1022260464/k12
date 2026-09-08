package com.k12.platform.assessment.dto;

import jakarta.validation.constraints.*;
import java.util.List;

public record HomeworkRecipientsRequest(
        @NotNull @Size(min = 1, max = 500) List<@NotNull @Positive Long> studentUserIds
) {}
