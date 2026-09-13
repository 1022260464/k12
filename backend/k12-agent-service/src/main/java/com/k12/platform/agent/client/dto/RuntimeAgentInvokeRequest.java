package com.k12.platform.agent.client.dto;

import java.util.Map;

/** Java Agent Service 调用 Python Runtime 使用的内部请求，不直接暴露给前端。 */
public record RuntimeAgentInvokeRequest(
        String inputText,
        String userId,
        Map<String, Object> context
) {
}
