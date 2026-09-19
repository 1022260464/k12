package com.k12.platform.learning.dto;

import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceBinding;

import java.time.Instant;
import java.util.List;

public record TeachingResourceResponse(
        Long id, String title, String description, String stageCode, String subject,
        String sourceNote, String originalFilename, String mimeType, Long sizeBytes,
        String status, String ragIndexStatus, Long createdBy, Long reviewedBy,
        String reviewNote, Instant reviewedTime, Long publishedBy, Instant publishedTime,
        Instant createdTime, Instant updatedTime, Long courseId, Long chapterId,
        String chapterTitle, String grade, String textbook, String knowledgeCode,
        List<BindingView> bindings
) {
    public record BindingView(Long courseId, Long chapterId, String chapterTitle, String courseTitle) { }

    public static TeachingResourceResponse from(TeachingResource resource) {
        return from(resource, List.of());
    }

    public static TeachingResourceResponse from(TeachingResource resource, List<BindingView> bindings) {
        return new TeachingResourceResponse(resource.getId(), resource.getTitle(), resource.getDescription(),
                resource.getStageCode(), resource.getSubject(), resource.getSourceNote(),
                resource.getOriginalFilename(), resource.getMimeType(), resource.getSizeBytes(),
                resource.getStatus(), resource.getRagIndexStatus(), resource.getCreatedBy(),
                resource.getReviewedBy(), resource.getReviewNote(), resource.getReviewedTime(),
                resource.getPublishedBy(), resource.getPublishedTime(), resource.getCreatedTime(),
                resource.getUpdatedTime(), resource.getCourseId(), resource.getChapterId(),
                resource.getChapterTitle(), resource.getGrade(), resource.getTextbook(),
                resource.getKnowledgeCode(), bindings == null ? List.of() : bindings);
    }

    public static BindingView fromBinding(TeachingResourceBinding binding, String courseTitle) {
        return new BindingView(binding.getCourseId(), binding.getChapterId(), binding.getChapterTitle(), courseTitle);
    }
}
