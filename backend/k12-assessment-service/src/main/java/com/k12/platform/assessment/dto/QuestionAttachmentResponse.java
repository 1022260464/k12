package com.k12.platform.assessment.dto;

import com.k12.platform.assessment.model.QuestionAttachment;

import java.time.Instant;

public record QuestionAttachmentResponse(Long id, Long questionId, String filename, String mimeType,
                                         Long sizeBytes, Instant createdTime) {
    public static QuestionAttachmentResponse from(QuestionAttachment attachment) {
        return new QuestionAttachmentResponse(attachment.getId(), attachment.getQuestionId(),
                attachment.getOriginalFilename(), attachment.getMimeType(),
                attachment.getSizeBytes(), attachment.getCreatedTime());
    }
}
