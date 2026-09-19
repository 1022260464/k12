package com.k12.platform.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 教学资料元数据。courseId/chapterId 仅兼容旧客户端，优先使用 bindings。
 */
public record TeachingResourceMetadata(
        @NotBlank @Size(max = 160) String title,
        @NotBlank(message = "资料简介不能为空") @Size(max = 1000) String description,
        @NotBlank @Size(max = 32) String stageCode,
        @NotBlank @Size(max = 64) String subject,
        @NotBlank @Size(max = 255) String sourceNote,
        @Positive Long courseId,
        @Positive Long chapterId,
        @Size(max = 32) String grade,
        @Size(max = 255) String textbook,
        @Size(max = 64) String knowledgeCode,
        @Valid @Size(max = 50) List<Binding> bindings
) {
    public record Binding(
            @Positive Long courseId,
            @Positive Long chapterId
    ) { }

    /** 兼容旧调用（无 bindings）。 */
    public TeachingResourceMetadata(String title, String description, String stageCode, String subject,
                                    String sourceNote, Long courseId, Long chapterId, String grade,
                                    String textbook, String knowledgeCode) {
        this(title, description, stageCode, subject, sourceNote, courseId, chapterId, grade, textbook,
                knowledgeCode, null);
    }
}
