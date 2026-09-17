package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionRequest;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.messaging.AgentPublishUnconfirmedException;
import com.k12.platform.agent.messaging.CodeExecutionTaskMessage;
import com.k12.platform.agent.messaging.CodeExecutionTaskPublisher;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.springframework.amqp.AmqpException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 代码执行应用服务。
 * 负责权限和业务参数校验，真正的用户代码只能交给 Python Runtime 的隔离沙箱执行。
 */
@Service
public class CodeExecutionService {

    private static final Logger log = LoggerFactory.getLogger(CodeExecutionService.class);

    static final int DEFAULT_TIMEOUT_SECONDS = 30;
    static final int MAX_TIMEOUT_SECONDS = 30;
    static final int MAX_CODE_LENGTH = 100_000;
    // 系统保留的运行分类，不属于可通过通用Agent接口调用的agent_config记录。
    private static final String AGENT_CODE = "code-tutor";

    private final AgentRuntimeClient runtimeClient;
    private final AgentRunPersistenceService persistenceService;
    private final CodeExecutionRecordMapper recordMapper;
    private final CodeExecutionTaskPublisher taskPublisher;
    private final AgentRabbitProperties rabbitProperties;
    private final CodeExecutionQuotaService quotaService;

    public CodeExecutionService(
            AgentRuntimeClient runtimeClient,
            AgentRunPersistenceService persistenceService,
            CodeExecutionRecordMapper recordMapper,
            CodeExecutionTaskPublisher taskPublisher,
            AgentRabbitProperties rabbitProperties,
            CodeExecutionQuotaService quotaService
    ) {
        this.runtimeClient = runtimeClient;
        this.persistenceService = persistenceService;
        this.recordMapper = recordMapper;
        this.taskPublisher = taskPublisher;
        this.rabbitProperties = rabbitProperties;
        this.quotaService = quotaService;
    }

    /**
     * 调用受控代码沙箱。管理员和拥有 agent:invoke 权限的用户才允许执行。
     * Java 与 Python 都会校验参数，避免绕过任意一层后直接提交异常任务。
     */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public CodeExecutionOutcome execute(String code, Integer timeoutSeconds, String executionMode) {
        validateCode(code);
        int effectiveTimeout = timeoutSeconds == null ? DEFAULT_TIMEOUT_SECONDS : timeoutSeconds;
        validateTimeout(effectiveTimeout);
        String effectiveMode = StringUtils.hasText(executionMode) ? executionMode : "SYNC";
        if (!"SYNC".equals(effectiveMode) && !"ASYNC".equals(effectiveMode)) {
            throw new IllegalArgumentException("执行模式只能是 SYNC 或 ASYNC");
        }
        if ("ASYNC".equals(effectiveMode) && !rabbitProperties.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "异步代码执行功能尚未启用");
        }
        Long userId = K12SecurityContext.requireUserId();
        quotaService.reserve(userId);
        String runId = UUID.randomUUID().toString();
        Instant startedTime = Instant.now();
        if ("ASYNC".equals(effectiveMode)) {
            return createAsyncExecution(runId, userId, code, effectiveTimeout, startedTime);
        }
        persistenceService.save(
                createRecord(runId, userId, code, effectiveTimeout, "SYNC", "RUNNING", startedTime),
                List.of()
        );

        ApiResponse<RuntimeCodeExecutionResponse> response;
        try {
            response = runtimeClient.executeCode(RuntimeCodeExecutionRequest.of(code, effectiveTimeout));
        } catch (FeignException exception) {
            // 不记录用户代码和上游响应正文，避免把学生代码或敏感信息写入日志。
            log.warn("代码执行Runtime调用失败，runId={}, status={}", runId, exception.status());
            persistenceService.failSyncCodeRun(
                    runId,
                    "SANDBOX_HTTP_" + exception.status(),
                    "代码执行服务暂不可用"
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "代码执行服务暂不可用，运行编号：" + runId
            );
        }

        RuntimeCodeExecutionResponse result;
        List<AgentArtifact> artifacts;
        try {
            result = requireValidRuntimeResponse(response);
            artifacts = recordMapper.toArtifacts(runId, result.artifacts());
        } catch (ResponseStatusException exception) {
            persistenceService.failSyncCodeRun(
                    runId,
                    "SANDBOX_INVALID_RESPONSE",
                    "代码执行服务返回数据不合法"
            );
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "代码执行服务返回数据不合法，运行编号：" + runId
            );
        }

        String errorCode = recordMapper.statusErrorCode(result.status());
        persistenceService.completeSyncCodeRun(
                runId,
                result.status(),
                result.stdout(),
                recordMapper.writeExecutionMetadata(result),
                errorCode,
                recordMapper.statusErrorMessage(result.status()),
                artifacts
        );
        return new CodeExecutionOutcome(runId, result);
    }

    private CodeExecutionOutcome createAsyncExecution(
            String runId,
            Long userId,
            String code,
            int timeoutSeconds,
            Instant createdTime
    ) {
        AgentRun run = createRecord(
                runId, userId, code, timeoutSeconds, "ASYNC", "PENDING", createdTime
        );
        run.setStartedTime(null);
        persistenceService.save(run, List.of());
        try {
            taskPublisher.publish(new CodeExecutionTaskMessage(
                    runId, code, timeoutSeconds, List.of()
            ));
        } catch (AgentPublishUnconfirmedException exception) {
            // 发布结果不确定时保留PENDING，避免自动重发造成同一份代码执行两次。
            log.info("代码执行投递确认暂未收到，请按原runId查询，runId={}", runId);
        } catch (AmqpException exception) {
            persistenceService.markDispatchFailed(runId);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "异步代码任务发送失败，运行编号：" + runId
            );
        }
        return new CodeExecutionOutcome(runId, new RuntimeCodeExecutionResponse(
                null, "PENDING", "", "", List.of(), null, null, null
        ));
    }

    private AgentRun createRecord(
            String runId,
            Long userId,
            String code,
            int timeoutSeconds,
            String executionMode,
            String status,
            Instant createdTime
    ) {
        AgentRun run = new AgentRun();
        run.setRunId(runId);
        run.setAgentCode(AGENT_CODE);
        run.setUserId(userId);
        run.setExecutionMode(executionMode);
        run.setInputText(code);
        run.setInputContext(recordMapper.writeInputContext(timeoutSeconds));
        run.setStatus(status);
        run.setStartedTime(createdTime);
        run.setCreatedTime(createdTime);
        run.setUpdatedTime(createdTime);
        return run;
    }

    private RuntimeCodeExecutionResponse requireValidRuntimeResponse(
            ApiResponse<RuntimeCodeExecutionResponse> response
    ) {
        RuntimeCodeExecutionResponse result = response == null ? null : response.data();
        if (response == null || response.code() != 200 || result == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "代码执行服务返回了无效数据");
        }
        recordMapper.validateResult(result);
        return result;
    }

    private void validateCode(String code) {
        if (!StringUtils.hasText(code)) {
            throw new IllegalArgumentException("代码不能为空");
        }
        if (code.length() > MAX_CODE_LENGTH) {
            throw new IllegalArgumentException("代码长度不能超过 " + MAX_CODE_LENGTH + " 个字符");
        }
    }

    private void validateTimeout(int timeoutSeconds) {
        if (timeoutSeconds < 1 || timeoutSeconds > MAX_TIMEOUT_SECONDS) {
            throw new IllegalArgumentException("执行超时时间必须在 1 到 " + MAX_TIMEOUT_SECONDS + " 秒之间");
        }
    }
}
