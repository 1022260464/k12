package com.k12.platform.agent.service;

import com.k12.platform.agent.config.AgentRunLifecycleProperties;
import com.k12.platform.agent.mapper.AgentRunMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** 每条记录独立事务，支持多个 Java 实例并发扫描，终态更新由行锁保护。 */
@Component
@ConditionalOnProperty(prefix = "k12.agent.lifecycle", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AgentRunTimeoutJob {
    private static final Logger log = LoggerFactory.getLogger(AgentRunTimeoutJob.class);
    private final AgentRunMapper runMapper;
    private final AgentRunPersistenceService persistenceService;
    private final AgentRunLifecycleProperties properties;

    public AgentRunTimeoutJob(AgentRunMapper runMapper, AgentRunPersistenceService persistenceService,
                              AgentRunLifecycleProperties properties) {
        this.runMapper = runMapper;
        this.persistenceService = persistenceService;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${k12.agent.lifecycle.scan-interval-ms:30000}",
            initialDelayString = "${k12.agent.lifecycle.scan-interval-ms:30000}")
    public void expireRuns() {
        Instant now = Instant.now();
        Instant pendingBefore = now.minusSeconds(properties.getQueueTimeoutSeconds());
        Instant runningBefore = now.minusSeconds(properties.getExecutionTimeoutSeconds());
        for (String runId : runMapper.findExpiredRunIds(pendingBefore, runningBefore, properties.getBatchSize())) {
            try {
                if (persistenceService.timeoutAsyncRun(runId, pendingBefore, runningBefore, now)) {
                    log.info("Agent 任务已标记超时，runId={}", runId);
                }
            } catch (RuntimeException exception) {
                log.error("Agent 超时更新失败，runId={}", runId, exception);
            }
        }
    }
}
