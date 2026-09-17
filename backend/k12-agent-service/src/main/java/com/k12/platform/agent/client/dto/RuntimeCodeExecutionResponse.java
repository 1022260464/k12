package com.k12.platform.agent.client.dto;

import java.util.List;

/** Python Runtime 返回的代码执行结果，字段与 FastAPI 沙箱接口保持一致。 */
public record RuntimeCodeExecutionResponse(
        String executionId,
        String status,
        String stdout,
        String stderr,
        List<RuntimeArtifactResponse> artifacts,
        Integer exitCode,
        Long durationMs,
        String providerRequestId
) {
}
