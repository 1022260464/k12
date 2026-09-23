package com.k12.platform.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record VisualProgrammingMissionOrderRequest(
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            @NotNull Long id,
            @NotNull Integer sortOrder,
            @NotNull Integer lockVersion
    ) {
    }
}
