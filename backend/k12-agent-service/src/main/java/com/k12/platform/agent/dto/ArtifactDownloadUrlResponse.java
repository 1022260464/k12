package com.k12.platform.agent.dto;

/** 返回给前端的短期产物访问地址，不包含对象存储凭据。 */
public record ArtifactDownloadUrlResponse(
        String artifactId,
        String url,
        int expiresSeconds
) {
}
