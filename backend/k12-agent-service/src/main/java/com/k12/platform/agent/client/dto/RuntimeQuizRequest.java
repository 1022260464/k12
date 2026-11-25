package com.k12.platform.agent.client.dto;

/** Python Runtime AI 组题的内部请求。 */
public record RuntimeQuizRequest(
        String topic,
        String stage,
        Integer count,
        String sourceText
) {
}
