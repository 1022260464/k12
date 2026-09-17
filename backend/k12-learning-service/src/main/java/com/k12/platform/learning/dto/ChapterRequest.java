package com.k12.platform.learning.dto;

import jakarta.validation.constraints.*;

/** 章节正文为纯文本；资源文件上传在文件服务接入后另行提供。 */
public record ChapterRequest(
        @NotBlank @Size(max = 128) String title,
        @NotBlank @Size(max = 20000) String content,
        @NotNull @Min(0) @Max(10000) Integer sortOrder
) {
}

