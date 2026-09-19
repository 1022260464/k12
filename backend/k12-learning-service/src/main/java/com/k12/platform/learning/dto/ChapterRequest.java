package com.k12.platform.learning.dto;

import jakarta.validation.constraints.*;

/** 章节导语必填（写入图谱描述并作为 AI 建议依据）；具体教学正文保存在小节中。 */
public record ChapterRequest(
        @NotBlank @Size(max = 128) String title,
        @NotBlank(message = "章节导语不能为空") @Size(max = 100000) String content,
        @NotNull @Min(0) @Max(10000) Integer sortOrder
) {
}
