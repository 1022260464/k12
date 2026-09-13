package com.k12.platform.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AgentRequest(
        @NotBlank(message = "智能体编码不能为空")
        @Pattern(regexp = "[a-z][a-z0-9-]{1,63}", message = "编码只能使用小写字母、数字和连字符")
        String code,
        @NotBlank(message = "智能体名称不能为空")
        @Size(max = 128, message = "智能体名称不能超过 128 个字符")
        String name,
        @NotBlank(message = "智能体类型不能为空")
        @Size(max = 64, message = "智能体类型不能超过 64 个字符")
        String type,
        @Size(max = 1000, message = "智能体描述不能超过 1000 个字符")
        String description
) {
}
