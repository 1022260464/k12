package com.k12.platform.agent.service;

import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;

/**
 * 一次已持久化的同步代码执行结果。
 *
 * runId 是 K12 平台自己的运行编号，用于查询 agent_run；execution 是 Python Runtime 的执行结果。
 */
public record CodeExecutionOutcome(
        String runId,
        RuntimeCodeExecutionResponse execution
) {
}
