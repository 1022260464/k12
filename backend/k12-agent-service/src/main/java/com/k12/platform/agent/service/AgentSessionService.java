package com.k12.platform.agent.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.agent.dto.AgentArtifactResponse;
import com.k12.platform.agent.dto.AgentSessionHistoryResponse;
import com.k12.platform.agent.dto.AgentSessionTurnResponse;
import com.k12.platform.agent.mapper.AgentArtifactMapper;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.model.AgentArtifact;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12SecurityContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 会话历史的唯一业务入口。
 *
 * agent_run 已经完整保存每次提问与回答，因此第一阶段直接把成功运行视为会话轮次，
 * 不额外维护一份容易与运行状态失去同步的消息表。
 */
@Service
public class AgentSessionService {
    private static final int MODEL_HISTORY_LIMIT = 6;
    private static final int MAX_HISTORY_LIMIT = 20;
    private static final int MAX_USER_MESSAGE_LENGTH = 500;
    private static final int MAX_ASSISTANT_MESSAGE_LENGTH = 1200;

    private final AgentRunMapper runMapper;
    private final AgentArtifactMapper artifactMapper;
    private final ObjectMapper objectMapper;

    public AgentSessionService(
            AgentRunMapper runMapper,
            AgentArtifactMapper artifactMapper,
            ObjectMapper objectMapper
    ) {
        this.runMapper = runMapper;
        this.artifactMapper = artifactMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * 注入可信会话历史。调用方传入的同名字段会被删除，防止伪造其他对话内容影响模型。
     */
    public Map<String, Object> enrichContext(
            Long userId,
            String agentCode,
            String sessionId,
            Map<String, Object> sourceContext
    ) {
        Map<String, Object> context = new LinkedHashMap<>();
        if (sourceContext != null) {
            context.putAll(sourceContext);
        }
        context.remove("conversation");
        context.remove("conversationHistory");
        // 已演示主题标记只能由服务端根据历史产物重建，防止前端伪造跳过或重复动画。
        context.remove("shownDemoTopics");
        // 无关提问计数只能由 IAM 账号状态提供，防止前端清零或篡改；会话历史不再累计。
        context.remove("offTopicStrikeCount");

        String normalizedSessionId = normalizeSessionId(sessionId);
        if (normalizedSessionId == null) {
            return context;
        }

        List<AgentRun> recentRuns = findRecentRuns(
                userId, agentCode, normalizedSessionId, MODEL_HISTORY_LIMIT);
        List<Map<String, String>> history = recentRuns.stream()
                .map(run -> {
                    Map<String, String> turn = new LinkedHashMap<>();
                    turn.put("user", truncate(run.getInputText(), MAX_USER_MESSAGE_LENGTH));
                    turn.put("assistant", truncate(run.getOutputText(), MAX_ASSISTANT_MESSAGE_LENGTH));
                    return turn;
                })
                .toList();

        context.put("conversation", Map.of(
                "schemaVersion", "1.0",
                "status", history.isEmpty() ? "EMPTY" : "LOADED",
                "previousTurnCount", history.size()
        ));
        context.put("conversationHistory", history);
        context.put("shownDemoTopics", collectShownDemoTopics(recentRuns));
        return context;
    }

    /**
     * 同一会话里已经下发过 ANIMATION 的主题码集合。
     * 用于教学助手：同主题追问不再重发动效，换主题首次仍完整下发。
     */
    private List<String> collectShownDemoTopics(List<AgentRun> recentRuns) {
        if (recentRuns.isEmpty()) {
            return List.of();
        }
        Map<String, List<AgentArtifact>> artifactsByRun = findArtifactsByRun(recentRuns);
        List<String> shown = new ArrayList<>();
        for (AgentRun run : recentRuns) {
            boolean hasAnimation = artifactsByRun
                    .getOrDefault(run.getRunId(), List.of())
                    .stream()
                    .anyMatch(artifact -> "ANIMATION".equals(artifact.getKind()));
            if (!hasAnimation) {
                continue;
            }
            String topicCode = readTopicCode(run.getOutputMetadata());
            if (topicCode != null && !shown.contains(topicCode)) {
                shown.add(topicCode);
            }
        }
        return shown;
    }

    private String readTopicCode(String outputMetadata) {
        JsonNode root = readJson(outputMetadata);
        if (root == null || !root.hasNonNull("topicCode")) {
            return null;
        }
        String topicCode = root.get("topicCode").asText("").trim();
        return StringUtils.hasText(topicCode) ? topicCode : null;
    }

    /** 查询当前 JWT 用户自己的会话，管理员也不会借此读取其他学生的对话。 */
    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "') or hasAuthority('" + K12Authorities.AGENT_READ + "')")
    public AgentSessionHistoryResponse getHistory(String agentCode, String sessionId, int limit) {
        if (limit < 1 || limit > MAX_HISTORY_LIMIT) {
            throw new IllegalArgumentException("limit 必须在 1 到 " + MAX_HISTORY_LIMIT + " 之间");
        }
        String normalizedSessionId = normalizeSessionId(sessionId);
        if (normalizedSessionId == null) {
            throw new IllegalArgumentException("会话编号不能为空");
        }

        List<AgentRun> runs = findRecentRuns(
                K12SecurityContext.requireUserId(), agentCode, normalizedSessionId, limit);
        Map<String, List<AgentArtifact>> artifactsByRun = findArtifactsByRun(runs);
        List<AgentSessionTurnResponse> turns = runs.stream()
                .map(run -> new AgentSessionTurnResponse(
                        run.getRunId(),
                        truncate(run.getInputText(), MAX_USER_MESSAGE_LENGTH),
                        truncate(run.getOutputText(), MAX_ASSISTANT_MESSAGE_LENGTH),
                        readJson(run.getOutputMetadata()),
                        run.getCreatedTime(),
                        artifactsByRun.getOrDefault(run.getRunId(), List.of()).stream()
                                .map(this::toArtifactResponse)
                                .toList()
                ))
                .toList();
        return new AgentSessionHistoryResponse(normalizedSessionId, agentCode, turns);
    }

    private List<AgentRun> findRecentRuns(Long userId, String agentCode, String sessionId, int limit) {
        List<AgentRun> runs = new ArrayList<>(runMapper.findRecentSuccessfulSessionRuns(
                userId, agentCode, sessionId, limit));
        // SQL 为了使用索引和 LIMIT 按时间倒序读取；对话协议按阅读顺序返回。
        Collections.reverse(runs);
        return runs;
    }

    private Map<String, List<AgentArtifact>> findArtifactsByRun(List<AgentRun> runs) {
        if (runs.isEmpty()) {
            return Map.of();
        }
        List<String> runIds = runs.stream().map(AgentRun::getRunId).toList();
        return artifactMapper.findByRunIds(runIds)
                .stream()
                .collect(Collectors.groupingBy(
                        AgentArtifact::getRunId,
                        LinkedHashMap::new,
                        Collectors.mapping(Function.identity(), Collectors.toList())
                ));
    }

    private AgentArtifactResponse toArtifactResponse(AgentArtifact artifact) {
        return new AgentArtifactResponse(
                artifact.getArtifactId(), artifact.getKind(), artifact.getTitle(),
                artifact.getMimeType(), artifact.getStorageUri(), readJson(artifact.getPayloadJson()),
                artifact.getSizeBytes(), artifact.getChecksumSha256(), artifact.getCreatedTime());
    }

    private JsonNode readJson(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return objectMapper.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库中的 Agent JSON 数据无法解析", exception);
        }
    }

    private String normalizeSessionId(String sessionId) {
        return StringUtils.hasText(sessionId) ? sessionId.trim() : null;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
