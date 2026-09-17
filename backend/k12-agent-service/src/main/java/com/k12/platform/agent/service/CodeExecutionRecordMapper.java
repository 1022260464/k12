package com.k12.platform.agent.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.model.AgentArtifact;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** 统一校验并转换同步HTTP与异步RabbitMQ返回的代码执行结果。 */
@Component
public class CodeExecutionRecordMapper {

    private static final Set<String> TERMINAL_STATUSES =
            Set.of("SUCCEEDED", "FAILED", "TIMED_OUT", "REJECTED");

    private final ObjectMapper objectMapper;

    public CodeExecutionRecordMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void validateResult(RuntimeCodeExecutionResponse result) {
        if (result == null
                || !StringUtils.hasText(result.executionId())
                || result.executionId().length() > 64
                || !TERMINAL_STATUSES.contains(result.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "代码执行服务返回了无效数据");
        }
    }

    public List<AgentArtifact> toArtifacts(String runId, List<RuntimeArtifactResponse> sources) {
        if (sources == null || sources.isEmpty()) {
            return List.of();
        }
        List<AgentArtifact> artifacts = new ArrayList<>(sources.size());
        for (RuntimeArtifactResponse source : sources) {
            if (source == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "代码执行产物不能为空");
            }
            requireText(source.artifactId(), 64, "artifactId");
            requireText(source.kind(), 32, "kind");
            requireText(source.mimeType(), 128, "mimeType");
            requireLength(source.title(), 255, "title");
            requireLength(source.uri(), 1024, "uri");

            AgentArtifact artifact = new AgentArtifact();
            artifact.setArtifactId(source.artifactId());
            artifact.setRunId(runId);
            artifact.setKind(source.kind());
            artifact.setTitle(source.title());
            artifact.setMimeType(source.mimeType());
            artifact.setStorageUri(source.uri());
            artifact.setPayloadJson(writeJson(source.payload()));
            artifact.setCreatedTime(Instant.now());
            artifacts.add(artifact);
        }
        return artifacts;
    }

    public String writeInputContext(int timeoutSeconds) {
        ObjectNode context = objectMapper.createObjectNode();
        context.put("language", "python");
        context.put("timeoutSeconds", timeoutSeconds);
        return writeJson(context);
    }

    public String writeExecutionMetadata(RuntimeCodeExecutionResponse result) {
        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("executionId", result.executionId());
        metadata.put("stderr", result.stderr());
        if (result.exitCode() != null) {
            metadata.put("exitCode", result.exitCode());
        }
        if (result.durationMs() != null) {
            metadata.put("runtimeDurationMs", result.durationMs());
        }
        // outputMetadata 会通过运行详情返回，因此不能写入云厂商 providerRequestId。
        return writeJson(metadata);
    }

    public String statusErrorCode(String status) {
        return "SUCCEEDED".equals(status) ? null : "CODE_EXECUTION_" + status;
    }

    public String statusErrorMessage(String status) {
        return switch (status) {
            case "FAILED" -> "代码执行失败";
            case "TIMED_OUT" -> "代码执行超时";
            case "REJECTED" -> "代码执行被安全策略拒绝";
            default -> null;
        };
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("代码执行数据无法序列化", exception);
        }
    }

    private void requireText(String value, int maxLength, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "代码执行结果缺少字段：" + field);
        }
        requireLength(value, maxLength, field);
    }

    private void requireLength(String value, int maxLength, String field) {
        if (value != null && value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "代码执行结果字段过长：" + field);
        }
    }
}
