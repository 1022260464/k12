package com.k12.platform.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * 前端提交的智能体运行参数。
 * userId 不允许由前端传入，Service 会从已经验证的 JWT 中读取当前用户 ID。
 */
public record AgentRunRequest(
        @NotBlank(message = "输入内容不能为空")
        @Size(max = 20000, message = "输入内容不能超过 20000 个字符")
        String inputText,
        @Size(max = 64, message = "会话编号不能超过 64 个字符")
        String sessionId,
        @Pattern(regexp = "SYNC|ASYNC", message = "执行模式只能是 SYNC 或 ASYNC")
        String executionMode,
        @Size(max = 50, message = "上下文字段不能超过 50 个")
        Map<String, Object> context
) {
}
