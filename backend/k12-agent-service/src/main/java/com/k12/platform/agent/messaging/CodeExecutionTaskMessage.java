package com.k12.platform.agent.messaging;

import java.util.List;

/** 与 Python CodeExecutionTaskMessage 保持一致的异步代码任务。 */
public record CodeExecutionTaskMessage(
        String runId,
        String code,
        Integer timeoutSeconds,
        List<String> packages
) {
}
