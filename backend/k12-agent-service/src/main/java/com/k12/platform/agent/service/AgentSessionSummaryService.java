package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeSummaryClient;
import com.k12.platform.agent.client.dto.RuntimeConversationSummaryRequest;
import com.k12.platform.agent.client.dto.RuntimeConversationSummaryResponse;
import com.k12.platform.agent.client.dto.RuntimeConversationTurn;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.mapper.AgentSessionSummaryMapper;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.agent.model.AgentSessionSummary;
import com.k12.platform.common.api.ApiResponse;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.concurrent.Executor;

/**
 * Maintains a persisted rolling summary for the older part of a conversation.
 *
 * The latest six successful turns remain verbatim in agent_run and are injected
 * separately. Summary work is always asynchronous and never blocks the chat
 * request that produced the run.
 */
@Service
public class AgentSessionSummaryService {
    private static final Logger log = LoggerFactory.getLogger(AgentSessionSummaryService.class);
    private static final int RECENT_TURNS_KEPT_VERBATIM = 6;
    private static final int BATCH_SIZE = 20;
    private static final int MAX_BATCHES_PER_TRIGGER = 5;
    private static final int MAX_USER_MESSAGE_LENGTH = 500;
    private static final int MAX_ASSISTANT_MESSAGE_LENGTH = 1200;
    private static final int MAX_SUMMARY_LENGTH = 4000;

    private final AgentRunMapper runMapper;
    private final AgentSessionSummaryMapper summaryMapper;
    private final AgentRuntimeSummaryClient summaryClient;
    private final Executor executor;
    private final boolean enabled;

    public AgentSessionSummaryService(
            AgentRunMapper runMapper,
            AgentSessionSummaryMapper summaryMapper,
            AgentRuntimeSummaryClient summaryClient,
            @Qualifier("agentSessionSummaryExecutor") Executor executor,
            @Value("${k12.agent.summary.enabled:true}") boolean enabled
    ) {
        this.runMapper = runMapper;
        this.summaryMapper = summaryMapper;
        this.summaryClient = summaryClient;
        this.executor = executor;
        this.enabled = enabled;
    }

    /** Queue a best-effort background refresh; failure never affects the user response. */
    public void requestRefresh(Long userId, String agentCode, String sessionId) {
        if (!enabled || userId == null || !StringUtils.hasText(agentCode)
                || !StringUtils.hasText(sessionId)) {
            return;
        }
        String normalizedAgentCode = agentCode.trim();
        String normalizedSessionId = sessionId.trim();
        try {
            executor.execute(() -> refreshSafely(
                    userId, normalizedAgentCode, normalizedSessionId));
        } catch (RuntimeException exception) {
            log.warn("会话摘要任务未能入队，userId={}, agentCode={}, sessionId={}, error={}",
                    userId, normalizedAgentCode, normalizedSessionId,
                    exception.getClass().getSimpleName());
        }
    }

    private void refreshSafely(Long userId, String agentCode, String sessionId) {
        try {
            refresh(userId, agentCode, sessionId);
        } catch (RuntimeException exception) {
            // Missing migration or a transient DB issue must not leak into the chat path.
            log.warn("刷新会话滚动摘要失败，userId={}, agentCode={}, sessionId={}, error={}",
                    userId, agentCode, sessionId, exception.getClass().getSimpleName());
        }
    }

    /** Package-visible for deterministic tests; callers in production use requestRefresh. */
    void refresh(Long userId, String agentCode, String sessionId) {
        for (int batch = 0; batch < MAX_BATCHES_PER_TRIGGER; batch++) {
            summaryMapper.insertEmptyIfAbsent(userId, agentCode, sessionId);
            AgentSessionSummary previous = summaryMapper.findByScope(userId, agentCode, sessionId);
            if (previous == null) {
                return;
            }

            Long throughRunDbId = runMapper.findSummaryBoundaryRunDbId(
                    userId, agentCode, sessionId, RECENT_TURNS_KEPT_VERBATIM);
            long coveredRunDbId = previous.getCoveredRunDbId() == null
                    ? 0L : previous.getCoveredRunDbId();
            if (throughRunDbId == null || throughRunDbId <= coveredRunDbId) {
                return;
            }

            List<AgentRun> runs = runMapper.findSuccessfulSessionRunsForSummary(
                    userId,
                    agentCode,
                    sessionId,
                    coveredRunDbId,
                    throughRunDbId,
                    BATCH_SIZE
            );
            if (runs.isEmpty()) {
                return;
            }

            int expectedVersion = previous.getSummaryVersion() == null
                    ? 0 : previous.getSummaryVersion();
            int summarizedTurnCount = (previous.getSummarizedTurnCount() == null
                    ? 0 : previous.getSummarizedTurnCount()) + runs.size();
            RuntimeConversationSummaryRequest request = new RuntimeConversationSummaryRequest(
                    truncate(previous.getSummaryText(), MAX_SUMMARY_LENGTH),
                    runs.stream()
                            .map(run -> new RuntimeConversationTurn(
                                    truncate(run.getInputText(), MAX_USER_MESSAGE_LENGTH),
                                    truncate(run.getOutputText(), MAX_ASSISTANT_MESSAGE_LENGTH)))
                            .toList(),
                    summarizedTurnCount
            );

            String summaryText;
            try {
                ApiResponse<RuntimeConversationSummaryResponse> response =
                        summaryClient.summarize(request);
                if (response == null || response.code() != 200 || response.data() == null) {
                    markFailed(userId, agentCode, sessionId, expectedVersion,
                            response == null ? "EMPTY_RESPONSE" : "RUNTIME_" + response.code());
                    return;
                }
                summaryText = normalizeSummary(response.data().summary());
            } catch (FeignException exception) {
                markFailed(userId, agentCode, sessionId, expectedVersion,
                        "RUNTIME_HTTP_" + Math.max(0, exception.status()));
                return;
            } catch (RuntimeException exception) {
                markFailed(userId, agentCode, sessionId, expectedVersion,
                        "SUMMARY_CLIENT_ERROR");
                return;
            }
            if (!StringUtils.hasText(summaryText)) {
                markFailed(userId, agentCode, sessionId, expectedVersion, "EMPTY_SUMMARY");
                return;
            }

            AgentRun last = runs.get(runs.size() - 1);
            int updated = summaryMapper.advanceIfVersion(
                    userId,
                    agentCode,
                    sessionId,
                    expectedVersion,
                    summaryText,
                    last.getId(),
                    last.getRunId(),
                    summarizedTurnCount
            );
            if (updated == 0) {
                // Another instance advanced the same coverage point. It owns the next batch.
                return;
            }
            if (runs.size() < BATCH_SIZE) {
                return;
            }
        }
    }

    private void markFailed(
            Long userId,
            String agentCode,
            String sessionId,
            int expectedVersion,
            String errorCode
    ) {
        try {
            summaryMapper.markFailedIfVersion(
                    userId, agentCode, sessionId, expectedVersion, errorCode);
        } catch (RuntimeException exception) {
            log.warn("记录会话摘要失败状态时出错，error={}", exception.getClass().getSimpleName());
        }
    }

    private String normalizeSummary(String value) {
        if (value == null) {
            return "";
        }
        return truncate(value.replace("\u0000", "").trim(), MAX_SUMMARY_LENGTH);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
