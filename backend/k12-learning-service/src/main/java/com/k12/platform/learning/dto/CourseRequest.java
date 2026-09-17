package com.k12.platform.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CourseRequest(
        @NotBlank(message = "课程标题不能为空")
        @Size(max = 128, message = "课程标题不能超过 128 个字符")
        String title,
        @NotBlank(message = "学科不能为空")
        @Size(max = 64, message = "学科不能超过 64 个字符")
        String subject,
        @NotBlank(message = "年级不能为空")
        @Size(max = 32, message = "年级不能超过 32 个字符")
        String gradeLevel,
        @Size(max = 1000, message = "课程描述不能超过 1000 个字符")
        String description,
        @Size(max = 500, message = "课程封面对象键不能超过 500 个字符")
        String coverObjectKey
) {
    /** 保留四参数构造器，兼容已有Java调用方和测试。 */
    public CourseRequest(String title, String subject, String gradeLevel, String description) {
        this(title, subject, gradeLevel, description, null);
    }
}
