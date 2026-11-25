package com.k12.platform.agent.client.dto;

/** Python Runtime 课件生成的内部请求。 */
public record RuntimeCoursewareRequest(
        String topic,
        String stage,
        Integer slideCount,
        String topicCode
) {
}
