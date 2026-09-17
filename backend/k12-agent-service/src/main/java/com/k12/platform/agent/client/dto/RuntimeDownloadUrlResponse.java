package com.k12.platform.agent.client.dto;

/** Python Runtime 生成的对象存储临时访问地址。 */
public record RuntimeDownloadUrlResponse(
        String objectKey,
        String url,
        int expiresSeconds
) {
}
