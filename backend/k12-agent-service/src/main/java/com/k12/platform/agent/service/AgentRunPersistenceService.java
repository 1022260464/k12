package com.k12.platform.agent.service;

import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * 运行记录事务边界。
 *
 * HTTP 调用不能放入数据库事务中，否则等待 Python 时会长时间占用数据库连接。
 * Runtime 返回以后，再由本类用一个短事务同时写入运行记录和全部产物。
 */
@Service
public class AgentRunPersistenceService {

    private static final Set<String> ASYNC_TERMINAL_STATUSES = Set.of("SUCCEEDED", "FAILED");
    private static final Set<String> CODE_EXECUTION_TERMINAL_STATUSES =
            Set.of("SUCCEEDED", "FAILED", "TIMED_OUT", "REJECTED");

    private final AgentRunMapper runMapper;
    private final AgentArtifactMapper artifactMapper;

    public AgentRunPersistenceService(AgentRunMapper runMapper, AgentArtifactMapper artifactMapper) {
        this.runMapper = runMapper;
        this.artifactMapper = artifactMapper;
    }

    @Transactional
    public void save(AgentRun run, List<AgentArtifact> artifacts) {
        runMapper.insert(run);
        for (AgentArtifact artifact : artifacts) {
            artifactMapper.insert(artifact);
        }
    }

    /**
     * 收敛同步代码执行并写入产物。
     *
     * Runtime HTTP 调用已经在事务外完成；这里只持有很短时间的行锁，避免占用连接池。
     */
    @Transactional
    public void completeSyncCodeRun(
            String runId,
            String status,
            String outputText,
            String outputMetadata,
            String errorCode,
            String errorMessage,
            List<AgentArtifact> artifacts
    ) {
        if (!CODE_EXECUTION_TERMINAL_STATUSES.contains(status)) {
            throw new IllegalArgumentException("代码执行结果状态不合法");
        }
        AgentRun run = requireRunningSyncRun(runId);
        if (isTerminal(run.getStatus())) {
            return;
        }

        Instant finishedTime = Instant.now();
        run.setStatus(status);
        run.setOutputText(outputText);
        run.setOutputMetadata(outputMetadata);
        run.setErrorCode(errorCode);
        run.setErrorMessage(errorMessage);
        run.setFinishedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        run.setDurationMs(durationFrom(run, finishedTime));
        runMapper.updateById(run);
        for (AgentArtifact artifact : artifacts) {
            artifactMapper.insert(artifact);
        }
    }

    /** Runtime 不可用或协议错误时，也要把 RUNNING 记录收敛为可审计的失败记录。 */
    @Transactional
    public void failSyncCodeRun(String runId, String errorCode, String errorMessage) {
        AgentRun run = requireRunningSyncRun(runId);
        if (isTerminal(run.getStatus())) {
            return;
        }
        finishLocally(run, "FAILED", errorCode, errorMessage, Instant.now());
    }

    /** 消费异步代码执行终态；重复消息不会重复插入产物。 */
    @Transactional
    public boolean completeAsyncCodeRun(
            String runId,
            String status,
            String outputText,
            String outputMetadata,
            String errorCode,
            String errorMessage,
            Instant startedTime,
            List<AgentArtifact> artifacts
    ) {
        if (!CODE_EXECUTION_TERMINAL_STATUSES.contains(status)) {
            throw new IllegalArgumentException("异步代码执行结果状态不合法");
        }
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null) {
            return false;
        }
        if (!"ASYNC".equals(run.getExecutionMode()) || !"code-tutor".equals(run.getAgentCode())) {
            throw new IllegalArgumentException("异步代码结果与运行记录不匹配");
        }
        if (isTerminal(run.getStatus())) {
            return true;
        }

        Instant finishedTime = Instant.now();
        if (run.getStartedTime() == null && startedTime != null) {
            run.setStartedTime(startedTime);
        }
        run.setStatus(status);
        run.setOutputText(outputText);
        run.setOutputMetadata(outputMetadata);
        run.setErrorCode(errorCode);
        run.setErrorMessage(errorMessage);
        run.setFinishedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        run.setDurationMs(durationFrom(run, finishedTime));
        runMapper.updateById(run);
        for (AgentArtifact artifact : artifacts) {
            artifactMapper.insert(artifact);
        }
        return true;
    }

    /** 消息发送失败后把已经创建的 PENDING 记录改为 FAILED。 */
    @Transactional
    public void markDispatchFailed(String runId) {
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null || !"PENDING".equals(run.getStatus())) {
            return;
        }
        Instant finishedTime = Instant.now();
        run.setStatus("FAILED");
        run.setErrorCode("RABBITMQ_PUBLISH_FAILED");
        run.setErrorMessage("异步任务发送失败");
        run.setFinishedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        run.setDurationMs(durationFrom(run, finishedTime));
        runMapper.updateById(run);
    }

    /**
     * 消费异步结果并写入产物。
     * RabbitMQ 可能重复投递消息，终态记录直接忽略，避免重复插入 artifactId。
     */
    @Transactional
    public boolean completeAsyncRun(
            String runId,
            String agentCode,
            String status,
            String outputText,
            String outputMetadata,
            Instant startedTime,
            List<AgentArtifact> artifacts
    ) {
        if (status == null || !ASYNC_TERMINAL_STATUSES.contains(status)) {
            throw new IllegalArgumentException("异步结果状态不合法");
        }
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null) {
            return false;
        }
        if (!agentCode.equals(run.getAgentCode()) || !"ASYNC".equals(run.getExecutionMode())) {
            throw new IllegalArgumentException("异步结果与运行记录不匹配");
        }
        if (isTerminal(run.getStatus())) {
            return true;
        }

        Instant finishedTime = Instant.now();
        // 终态消息也携带开始时间，可在 RUNNING 消息未成功处理时进行兜底。
        if (run.getStartedTime() == null && startedTime != null) {
            run.setStartedTime(startedTime);
        }
        run.setStatus(status);
        run.setOutputMetadata(outputMetadata);
        run.setFinishedTime(finishedTime);
        run.setUpdatedTime(finishedTime);
        run.setDurationMs(durationFrom(run, finishedTime));
        if ("FAILED".equals(status)) {
            // Python Worker 的原始异常可能包含内部实现，不直接返回给前端。
            run.setOutputText(null);
            run.setOutputMetadata(null);
            run.setErrorCode("AGENT_EXECUTION_FAILED");
            run.setErrorMessage("智能体执行失败");
        } else {
            run.setOutputText(outputText);
            for (AgentArtifact artifact : artifacts) {
                artifactMapper.insert(artifact);
            }
        }
        runMapper.updateById(run);
        return true;
    }

    /** Worker 真正取到异步任务时，将 PENDING 更新为 RUNNING 并记录开始时间。 */
    @Transactional
    public boolean markAsyncRunStarted(String runId, String agentCode, Instant startedTime) {
        if (startedTime == null) {
            throw new IllegalArgumentException("异步任务开始时间不能为空");
        }
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null) {
            return false;
        }
        if (!agentCode.equals(run.getAgentCode()) || !"ASYNC".equals(run.getExecutionMode())) {
            throw new IllegalArgumentException("异步开始消息与运行记录不匹配");
        }
        if (isTerminal(run.getStatus())) {
            return true;
        }

        // 重复投递开始消息时保留第一次开始时间，保证该操作幂等。
        if (run.getStartedTime() == null) {
            run.setStartedTime(startedTime);
        }
        run.setStatus("RUNNING");
        run.setUpdatedTime(Instant.now());
        runMapper.updateById(run);
        return true;
    }

    private boolean isTerminal(String status) {
        return "SUCCEEDED".equals(status) || "FAILED".equals(status)
                || "TIMED_OUT".equals(status) || "CANCELLED".equals(status)
                || "REJECTED".equals(status);
    }

    private AgentRun requireRunningSyncRun(String runId) {
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null) {
            throw new IllegalStateException("同步运行记录不存在：" + runId);
        }
        if (!"SYNC".equals(run.getExecutionMode())) {
            throw new IllegalArgumentException("运行记录不是同步执行：" + runId);
        }
        return run;
    }

    /** 在同一个行锁事务内校验归属与状态，防止取消和完成消息相互覆盖。 */
    @Transactional
    public AgentRun cancelAsyncRun(String runId, Long userId, boolean admin) {
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null || (!admin && !userId.equals(run.getUserId()))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "运行记录不存在");
        }
        if (!"ASYNC".equals(run.getExecutionMode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "仅支持取消异步任务");
        }
        if ("CANCELLED".equals(run.getStatus())) {
            return run;
        }
        if (!"PENDING".equals(run.getStatus()) && !"RUNNING".equals(run.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前任务状态不允许取消");
        }
        finishLocally(run, "CANCELLED", "RUN_CANCELLED", "任务已取消", Instant.now());
        return run;
    }

    /** 定时扫描只查候选编号；此处取得行锁后再次检查，避免覆盖刚完成的任务。 */
    @Transactional
    public boolean timeoutAsyncRun(String runId, Instant pendingBefore, Instant runningBefore, Instant now) {
        AgentRun run = runMapper.selectForUpdateByRunId(runId);
        if (run == null || !"ASYNC".equals(run.getExecutionMode())) {
            return false;
        }
        boolean pendingExpired = "PENDING".equals(run.getStatus()) && run.getCreatedTime() != null
                && !run.getCreatedTime().isAfter(pendingBefore);
        Instant executionStart = run.getStartedTime() == null ? run.getCreatedTime() : run.getStartedTime();
        boolean runningExpired = "RUNNING".equals(run.getStatus()) && executionStart != null
                && !executionStart.isAfter(runningBefore);
        if (!pendingExpired && !runningExpired) {
            return false;
        }
        finishLocally(run, "TIMED_OUT", pendingExpired ? "QUEUE_TIMEOUT" : "EXECUTION_TIMEOUT",
                pendingExpired ? "任务排队超时" : "任务执行超时", now);
        return true;
    }

    private void finishLocally(AgentRun run, String status, String code, String message, Instant now) {
        run.setStatus(status);
        run.setErrorCode(code);
        run.setErrorMessage(message);
        run.setFinishedTime(now);
        run.setUpdatedTime(now);
        run.setDurationMs(durationFrom(run, now));
        runMapper.updateById(run);
    }

    private long durationFrom(AgentRun run, Instant finishedTime) {
        Instant start = run.getStartedTime();
        if (start == null) {
            start = run.getCreatedTime();
        }
        return start == null ? 0L : Math.max(0L, Duration.between(start, finishedTime).toMillis());
    }
}
