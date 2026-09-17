package com.k12.platform.agent.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeDownloadUrlResponse;
import com.k12.platform.agent.dto.ArtifactDownloadUrlResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.Arrays;

/**
 * 管理运行产物的受控访问。
 *
 * 浏览器不能把数据库中的 s3:// 地址直接交给 MinIO。这里先校验当前用户是否
 * 有权查看对应运行及产物，再通过内部接口换取短期签名 URL。
 */
@Service
public class AgentArtifactAccessService {

    private static final Logger log = LoggerFactory.getLogger(AgentArtifactAccessService.class);
    private static final String S3_PREFIX = "s3://";

    private final AgentRunMapper runMapper;
    private final AgentArtifactMapper artifactMapper;
    private final AgentRuntimeClient runtimeClient;

    public AgentArtifactAccessService(
            AgentRunMapper runMapper,
            AgentArtifactMapper artifactMapper,
            AgentRuntimeClient runtimeClient
    ) {
        this.runMapper = runMapper;
        this.artifactMapper = artifactMapper;
        this.runtimeClient = runtimeClient;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public ArtifactDownloadUrlResponse createDownloadUrl(String runId, String artifactId) {
        Long userId = K12SecurityContext.requireUserId();
        AgentRun run = runMapper.findVisibleByRunId(runId, userId, isAdmin());
        if (run == null) {
            // 不区分不存在和无权访问，避免攻击者枚举其他用户的运行编号。
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "运行记录不存在");
        }

        AgentArtifact artifact = artifactMapper.selectOne(
                Wrappers.lambdaQuery(AgentArtifact.class)
                        .eq(AgentArtifact::getRunId, runId)
                        .eq(AgentArtifact::getArtifactId, artifactId)
                        .last("LIMIT 1")
        );
        if (artifact == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "运行产物不存在");
        }

        String objectKey = extractObjectKey(artifact.getStorageUri());
        ApiResponse<RuntimeDownloadUrlResponse> runtimeResponse;
        try {
            runtimeResponse = runtimeClient.createDownloadUrl(objectKey);
        } catch (FeignException exception) {
            log.warn("获取产物临时地址失败，runId={}, artifactId={}, status={}",
                    runId, artifactId, exception.status());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "产物存储服务暂时不可用");
        }

        RuntimeDownloadUrlResponse result = runtimeResponse == null ? null : runtimeResponse.data();
        if (runtimeResponse == null || runtimeResponse.code() != 200 || result == null
                || !objectKey.equals(result.objectKey())
                || result.expiresSeconds() <= 0
                || !isHttpUrl(result.url())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "产物存储服务返回了无效地址");
        }
        return new ArtifactDownloadUrlResponse(artifactId, result.url(), result.expiresSeconds());
    }

    private String extractObjectKey(String storageUri) {
        if (!StringUtils.hasText(storageUri) || !storageUri.startsWith(S3_PREFIX)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该产物没有可下载的对象存储文件");
        }
        String bucketAndKey = storageUri.substring(S3_PREFIX.length());
        int separator = bucketAndKey.indexOf('/');
        if (separator <= 0 || separator == bucketAndKey.length() - 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "产物存储地址格式错误");
        }
        String objectKey = bucketAndKey.substring(separator + 1);
        boolean unsafePath = Arrays.stream(objectKey.split("/"))
                .anyMatch(part -> "..".equals(part));
        if (unsafePath || objectKey.contains("\\")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "产物存储地址格式错误");
        }
        return objectKey;
    }

    private boolean isHttpUrl(String value) {
        if (!StringUtils.hasText(value)) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && StringUtils.hasText(uri.getHost());
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isAdmin() {
        return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN);
    }
}
