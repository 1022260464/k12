package com.k12.platform.assessment.dto;

import java.util.List;

public record SubmissionDetailResponse(HomeworkSubmissionResponse submission,
                                       List<SubmissionAnswerResponse> answers) {
}
