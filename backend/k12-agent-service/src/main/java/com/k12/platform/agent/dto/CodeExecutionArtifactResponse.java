package com.k12.platform.agent.dto;

import com.fasterxml.jackson.databind.JsonNode;

/** 代码沙箱产生的图表、图片、文件或结构化执行结果。 */
public record CodeExecutionArtifactResponse(
        String artifactId,
        String kind,
        String title,
        String mimeType,
        String storageUri,
        JsonNode payload
) {
}
