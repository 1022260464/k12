package com.k12.platform.agent.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;

/** 用户提交的Python代码执行请求。当前仅支持沙箱镜像内预装的依赖。 */
public record CodeExecutionRequest(
        @NotBlank(message = "代码不能为空")
        @Size(max = 100_000, message = "代码长度不能超过100000个字符")
        String code,

        @Min(value = 1, message = "执行超时时间不能小于1秒")
        @Max(value = 30, message = "执行超时时间不能超过30秒")
        Integer timeoutSeconds,

        @Pattern(regexp = "SYNC|ASYNC", message = "执行模式只能是SYNC或ASYNC")
        String executionMode
) {
}
