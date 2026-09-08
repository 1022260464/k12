package com.k12.platform.assessment.dto;

import java.util.List;

public record SubmissionPageResponse(List<HomeworkSubmissionResponse> items, int page, int size, long total) {}
