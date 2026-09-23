package com.k12.platform.learning.dto;

import java.util.List;

public record VisualProgrammingEvaluationResponse(
        boolean passed,
        int stars,
        List<Check> checks
) {
    public record Check(String id, String label, boolean passed) {
    }
}

