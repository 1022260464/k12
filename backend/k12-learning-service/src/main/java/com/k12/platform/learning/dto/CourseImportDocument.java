package com.k12.platform.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CourseImportDocument(
        @NotNull @Min(1) @Max(1) Integer version,
        @NotEmpty @Size(max = 20) List<@Valid CourseEntry> courses
) {
    public record CourseEntry(
            @NotBlank @Size(max = 128) String title,
            @NotBlank @Size(max = 64) String subject,
            @NotBlank @Size(max = 32) String gradeLevel,
            @Size(max = 1000) String description,
            @NotEmpty @Size(max = 30) List<@Valid ChapterEntry> chapters
    ) { }

    public record ChapterEntry(
            @NotBlank @Size(max = 128) String title,
            @NotBlank(message = "章节导语不能为空") @Size(max = 100000) String content,
            @NotNull @Min(0) @Max(10000) Integer sortOrder,
            @Size(max = 100) List<@Valid SectionEntry> sections
    ) { }

    public record SectionEntry(
            @NotBlank @Size(max = 128) String title,
            @NotBlank @Size(max = 100000) String content,
            @NotNull @Min(0) @Max(10000) Integer sortOrder
    ) { }
}
