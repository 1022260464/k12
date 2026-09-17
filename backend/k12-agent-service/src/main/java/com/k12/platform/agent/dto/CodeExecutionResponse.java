package com.k12.platform.agent.dto;

import java.util.List;

/** 面向前端的代码执行结果；异步PENDING阶段executionId为空，不暴露云厂商内部请求编号。 */
public record CodeExecutionResponse(
        String runId,
        String executionId,
        String status,
        String stdout,
        String stderr,
        List<CodeExecutionArtifactResponse> artifacts,
        Integer exitCode,
        Long durationMs
) {
}
