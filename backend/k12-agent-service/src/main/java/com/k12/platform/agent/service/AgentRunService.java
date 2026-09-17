package com.k12.platform.agent.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.client.AgentRuntimeClient;
import com.k12.platform.agent.client.dto.RuntimeAgentInvokeRequest;
import com.k12.platform.agent.client.dto.RuntimeAgentRunResponse;
import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.config.AgentRabbitProperties;
import com.k12.platform.agent.dto.AgentArtifactResponse;
import com.k12.platform.agent.dto.AgentRunPageResponse;
import com.k12.platform.agent.dto.AgentRunRequest;
import com.k12.platform.agent.dto.AgentRunResponse;
import com.k12.platform.agent.dto.AgentRunSummaryResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.messaging.AgentRunTaskMessage;
import com.k12.platform.agent.messaging.AgentRunTaskPublisher;
import com.k12.platform.agent.messaging.AgentPublishUnconfirmedException;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.agent.model.TeachingAgent;
import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import feign.FeignException;
import org.springframework.amqp.AmqpException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AgentRunService {
    private static final Logger log = LoggerFactory.getLogger(AgentRunService.class);

    private static final String SYNC = "SYNC";
    private static final String ASYNC = "ASYNC";
    private static final String ENABLED = "ENABLED";
    private static final Set<String> TERMINAL_STATUSES = Set.of("SUCCEEDED", "FAILED");
    private static final int MAX_PAGE_SIZE = 100;

    private final AgentMapper agentMapper;
    private final AgentRunMapper runMapper;
    private final AgentArtifactMapper artifactMapper;
    private final AgentRuntimeClient runtimeClient;
    private final AgentRunPersistenceService persistenceService;
    private final AgentRunTaskPublisher taskPublisher;
    private final AgentRabbitProperties rabbitProperties;
    private final ObjectMapper objectMapper;
    private final LearnerContextEnricher learnerContextEnricher;
    private final AgentSessionService sessionService;

    public AgentRunService(
            AgentMapper agentMapper,
            AgentRunMapper runMapper,
            AgentArtifactMapper artifactMapper,
            AgentRuntimeClient runtimeClient,
            AgentRunPersistenceService persistenceService,
            AgentRunTaskPublisher taskPublisher,
            AgentRabbitProperties rabbitProperties,
            ObjectMapper objectMapper,
            LearnerContextEnricher learnerContextEnricher,
            AgentSessionService sessionService
    ) {
        this.agentMapper = agentMapper;
        this.runMapper = runMapper;
        this.artifactMapper = artifactMapper;
        this.runtimeClient = runtimeClient;
        this.persistenceService = persistenceService;
        this.taskPublisher = taskPublisher;
        this.rabbitProperties = rabbitProperties;
        this.objectMapper = objectMapper;
        this.learnerContextEnricher = learnerContextEnricher;
        this.sessionService = sessionService;
    }

    /**
     * 同步调用智能体。
     *
     * 前端只提交输入；userId 始终从 JWT 读取，再传给 Python Runtime，防止冒用其他账号。
     */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public AgentRunResponse createRun(String agentCode, AgentRunRequest request) {
        TeachingAgent agent = findAgentByCode(agentCode);
        if (agent == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "智能体不存在");
        }
        if (!ENABLED.equals(agent.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "智能体当前未启用");
        }

        Long userId = K12SecurityContext.requireUserId();
        // 教学 Agent 使用 IAM 和 Assessment 的服务端数据覆盖前端可伪造的画像字段。
        Map<String, Object> context = learnerContextEnricher.enrich(
                agentCode,
                userId,
                request.context()
        );
        // sessionId 不只是运行标签；服务端读取可信历史并覆盖前端可能伪造的同名字段。
        context = sessionService.enrichContext(userId, agentCode, request.sessionId(), context);
        String executionMode = StringUtils.hasText(request.executionMode()) ? request.executionMode() : SYNC;
        if (!SYNC.equals(executionMode) && !ASYNC.equals(executionMode)) {
            throw new IllegalArgumentException("执行模式只能是 SYNC 或 ASYNC");
        }
        if (ASYNC.equals(executionMode)) {
            return createAsyncRun(agentCode, userId, request, context);
        }
        Instant startedTime = Instant.now();

        ApiResponse<RuntimeAgentRunResponse> runtimeResponse;
        try {
            runtimeResponse = runtimeClient.invoke(
                    agentCode,
                    new RuntimeAgentInvokeRequest(request.inputText(), userId.toString(), context)
            );
        } catch (FeignException exception) {
            String runId = UUID.randomUUID().toString();
            saveFailedRun(runId, agentCode, userId, request, context, startedTime,
                    "RUNTIME_HTTP_" + exception.status(), "智能体运行时调用失败");
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "智能体运行时暂时不可用，运行编号：" + runId
            );
        }

        RuntimeAgentRunResponse result;
        List<AgentArtifact> artifacts;
        try {
            result = requireValidRuntimeResponse(runtimeResponse, agentCode);
            artifacts = toArtifacts(result.runId(), result.artifacts());
        } catch (ResponseStatusException exception) {
            String failedRunId = UUID.randomUUID().toString();
            saveFailedRun(failedRunId, agentCode, userId, request, context, startedTime,
                    "RUNTIME_INVALID_RESPONSE", "智能体运行时返回数据不合法");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "智能体运行时返回数据不合法，运行编号：" + failedRunId);
        }
        Instant finishedTime = Instant.now();
        AgentRun run = toRun(result, userId, request, context, startedTime, finishedTime);
        if ("FAILED".equals(result.status())) {
            run.setOutputText(null);
            run.setOutputMetadata(null);
            run.setErrorCode("AGENT_EXECUTION_FAILED");
            run.setErrorMessage("智能体执行失败");
            artifacts = List.of();
        }
        persistenceService.save(run, artifacts);

        return toResponse(run, artifacts);
    }

    private AgentRunResponse createAsyncRun(
            String agentCode,
            Long userId,
            AgentRunRequest request,
            Map<String, Object> context
    ) {
        if (!rabbitProperties.isEnabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "异步智能体功能尚未启用");
        }

        Instant now = Instant.now();
        AgentRun run = new AgentRun();
        run.setRunId(UUID.randomUUID().toString());
        run.setAgentCode(agentCode);
        run.setUserId(userId);
        run.setSessionId(trimToNull(request.sessionId()));
        run.setExecutionMode(ASYNC);
        run.setInputText(request.inputText());
        run.setInputContext(writeJson(context));
        run.setStatus("PENDING");
        run.setCreatedTime(now);
        run.setUpdatedTime(now);
        persistenceService.save(run, List.of());

        try {
            taskPublisher.publish(new AgentRunTaskMessage(
                    run.getRunId(),
                    agentCode,
                    request.inputText(),
                    userId.toString(),
                    context
            ));
        } catch (AgentPublishUnconfirmedException exception) {
            // 保留可查询的 PENDING，后续由 Worker 结果或超时扫描收敛，避免误判失败后重复执行。
            log.info("Agent 投递确认暂未收到，请按原 runId 查询，runId={}", run.getRunId());
        } catch (AmqpException exception) {
            persistenceService.markDispatchFailed(run.getRunId());
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "异步任务发送失败，运行编号：" + run.getRunId()
            );
        }
        return toResponse(run, List.of());
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public AgentRunPageResponse listRuns(int page, int size) {
        PageRange range = pageRange(page, size);
        Long userId = K12SecurityContext.requireUserId();
        List<AgentRun> rows = runMapper.findVisiblePage(
                userId,
                isAdmin(),
                range.offset(),
                range.size() + 1
        );
        boolean hasNext = rows.size() > range.size();
        List<AgentRunSummaryResponse> items = rows.stream()
                .limit(range.size())
                .map(this::toSummary)
                .toList();
        return new AgentRunPageResponse(range.page(), range.size(), hasNext, items);
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public AgentRunResponse getRun(String runId) {
        AgentRun run = requireVisibleRun(runId);
        return toResponse(run, findArtifacts(runId));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public List<AgentArtifactResponse> listArtifacts(String runId) {
        requireVisibleRun(runId);
        return findArtifacts(runId).stream().map(this::toArtifactResponse).toList();
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public AgentRunResponse cancelRun(String runId) {
        AgentRun run = persistenceService.cancelAsyncRun(runId, K12SecurityContext.requireUserId(), isAdmin());
        return toResponse(run, List.of());
    }

    /** 人工重试创建新的运行编号，保留原失败记录；不会自动重试有副作用的工具。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_INVOKE + "')")
    public AgentRunResponse retryRun(String runId) {
        AgentRun source = requireVisibleRun(runId);
        if (!"ASYNC".equals(source.getExecutionMode())
                || !("FAILED".equals(source.getStatus()) || "TIMED_OUT".equals(source.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅允许重试失败或超时的异步任务");
        }
        /*
         * code-tutor 使用代码执行专用消息协议，不能复用普通 AgentRunRequest。
         * 重新提交代码也能再次执行请求校验，避免绕过超时、代码长度和依赖包限制。
         */
        if ("code-tutor".equals(source.getAgentCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "代码执行任务请通过代码执行接口重新提交");
        }
        Map<String, Object> context = StringUtils.hasText(source.getInputContext())
                ? objectMapper.convertValue(readJson(source.getInputContext()),
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { })
                : Map.of();
        // 身份仍取当前 JWT；管理员重试也不会冒用原用户身份执行。
        AgentRunResponse retried = createRun(source.getAgentCode(), new AgentRunRequest(
                source.getInputText(), source.getSessionId(), ASYNC, context));
        log.info("Agent 人工重试，sourceRunId={}, newRunId={}, operatorUserId={}",
                runId, retried.runId(), retried.userId());
        return retried;
    }

    private TeachingAgent findAgentByCode(String agentCode) {
        return agentMapper.selectOne(Wrappers.lambdaQuery(TeachingAgent.class)
                .eq(TeachingAgent::getCode, agentCode)
                .last("LIMIT 1"));
    }

    private AgentRun requireVisibleRun(String runId) {
        AgentRun run = runMapper.findVisibleByRunId(
                runId,
                K12SecurityContext.requireUserId(),
                isAdmin()
        );
        if (run == null) {
            // 对无权访问和确实不存在统一返回 404，避免泄露其他用户的运行编号。
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "运行记录不存在");
        }
        return run;
    }

    private RuntimeAgentRunResponse requireValidRuntimeResponse(
            ApiResponse<RuntimeAgentRunResponse> response,
            String expectedAgentCode
    ) {
        RuntimeAgentRunResponse result = response == null ? null : response.data();
        if (response == null || response.code() != 200 || result == null
                || !StringUtils.hasText(result.runId())
                || result.runId().length() > 64
                || !expectedAgentCode.equals(result.agentCode())
                || result.status() == null || !TERMINAL_STATUSES.contains(result.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "智能体运行时返回了无效数据");
        }
        return result;
    }

    private AgentRun toRun(
            RuntimeAgentRunResponse result,
            Long userId,
            AgentRunRequest request,
            Map<String, Object> context,
            Instant startedTime,
            Instant finishedTime
    ) {
        AgentRun run = new AgentRun();
        run.setRunId(result.runId());
        run.setAgentCode(result.agentCode());
        run.setUserId(userId);
        run.setSessionId(trimToNull(request.sessionId()));
        run.setExecutionMode(SYNC);
        run.setInputText(request.inputText());
        run.setInputContext(writeJson(context));
        run.setStatus(result.status());
        run.setOutputText(result.outputText());
        run.setOutputMetadata(writeJson(result.metadata()));
        run.setStartedTime(startedTime);
        run.setFinishedTime(finishedTime);
        run.setDurationMs(Duration.between(startedTime, finishedTime).toMillis());
        run.setCreatedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        return run;
    }

    private List<AgentArtifact> toArtifacts(String runId, List<RuntimeArtifactResponse> runtimeArtifacts) {
        if (runtimeArtifacts == null || runtimeArtifacts.isEmpty()) {
            return List.of();
        }
        List<AgentArtifact> artifacts = new ArrayList<>(runtimeArtifacts.size());
        for (RuntimeArtifactResponse source : runtimeArtifacts) {
            if (source == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "智能体产物不能为空");
            }
            requireRuntimeText(source.artifactId(), 64, "artifactId");
            requireRuntimeText(source.kind(), 32, "kind");
            requireRuntimeText(source.mimeType(), 128, "mimeType");
            requireRuntimeLength(source.title(), 255, "title");
            requireRuntimeLength(source.uri(), 1024, "uri");

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

    private void saveFailedRun(
            String runId,
            String agentCode,
            Long userId,
            AgentRunRequest request,
            Map<String, Object> context,
            Instant startedTime,
            String errorCode,
            String errorMessage
    ) {
        Instant finishedTime = Instant.now();
        AgentRun run = new AgentRun();
        run.setRunId(runId);
        run.setAgentCode(agentCode);
        run.setUserId(userId);
        run.setSessionId(trimToNull(request.sessionId()));
        run.setExecutionMode(SYNC);
        run.setInputText(request.inputText());
        run.setInputContext(writeJson(context));
        run.setStatus("FAILED");
        run.setErrorCode(errorCode);
        run.setErrorMessage(errorMessage);
        run.setStartedTime(startedTime);
        run.setFinishedTime(finishedTime);
        run.setDurationMs(Duration.between(startedTime, finishedTime).toMillis());
        run.setCreatedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        persistenceService.save(run, List.of());
    }

    private List<AgentArtifact> findArtifacts(String runId) {
        return artifactMapper.selectList(Wrappers.lambdaQuery(AgentArtifact.class)
                .eq(AgentArtifact::getRunId, runId)
                .orderByAsc(AgentArtifact::getId));
    }

    private AgentRunResponse toResponse(AgentRun run, List<AgentArtifact> artifacts) {
        return new AgentRunResponse(
                run.getRunId(),
                run.getAgentCode(),
                run.getUserId(),
                run.getSessionId(),
                run.getExecutionMode(),
                run.getInputText(),
                readJson(run.getInputContext()),
                run.getStatus(),
                run.getOutputText(),
                readJson(run.getOutputMetadata()),
                run.getErrorCode(),
                run.getErrorMessage(),
                run.getDurationMs(),
                run.getStartedTime(),
                run.getFinishedTime(),
                run.getCreatedTime(),
                artifacts.stream().map(this::toArtifactResponse).toList()
        );
    }

    private AgentRunSummaryResponse toSummary(AgentRun run) {
        return new AgentRunSummaryResponse(
                run.getRunId(),
                run.getAgentCode(),
                run.getUserId(),
                run.getSessionId(),
                run.getExecutionMode(),
                run.getStatus(),
                run.getErrorCode(),
                run.getDurationMs(),
                run.getStartedTime(),
                run.getFinishedTime(),
                run.getCreatedTime()
        );
    }

    private AgentArtifactResponse toArtifactResponse(AgentArtifact artifact) {
        return new AgentArtifactResponse(
                artifact.getArtifactId(),
                artifact.getKind(),
                artifact.getTitle(),
                artifact.getMimeType(),
                artifact.getStorageUri(),
                readJson(artifact.getPayloadJson()),
                artifact.getSizeBytes(),
                artifact.getChecksumSha256(),
                artifact.getCreatedTime()
        );
    }

    private PageRange pageRange(int page, int size) {
        if (page < 1) {
            throw new IllegalArgumentException("page 必须大于等于 1");
        }
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size 必须在 1 到 " + MAX_PAGE_SIZE + " 之间");
        }
        return new PageRange(page, size, (long) (page - 1) * size);
    }

    private boolean isAdmin() {
        return K12SecurityContext.hasAuthority(K12Authorities.ROLE_ADMIN);
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("JSON 数据无法序列化", exception);
        }
    }

    private JsonNode readJson(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return objectMapper.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库中的 JSON 数据格式错误", exception);
        }
    }

    private void requireRuntimeText(String value, int maxLength, String field) {
        if (!StringUtils.hasText(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "智能体运行时缺少字段：" + field);
        }
        requireRuntimeLength(value, maxLength, field);
    }

    private void requireRuntimeLength(String value, int maxLength, String field) {
        if (value != null && value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "智能体运行时字段过长：" + field);
        }
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private record PageRange(int page, int size, long offset) {
    }
}
