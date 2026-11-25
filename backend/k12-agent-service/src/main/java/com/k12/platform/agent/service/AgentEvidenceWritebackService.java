package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AssessmentEvidenceClient;
import com.k12.platform.agent.client.dto.EvidenceWritebackRequest;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.common.api.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 教学运行完成后的证据写回：学生与教学 Agent 的每次有效对话，
 * 在服务端解析出知识点归因（focusCode）后落一条 TUTOR_CHAT 证据。
 *
 * <p>写回是尽力而为：Assessment 不可用或归因缺失时只记日志，
 * 绝不阻断教学响应；重复写回由 Assessment 的唯一键去重。</p>
 */
@Service
public class AgentEvidenceWritebackService {
    private static final Logger log = LoggerFactory.getLogger(AgentEvidenceWritebackService.class);
    private static final Set<String> EVIDENCE_AGENT_CODES = Set.of(
            "teaching-assistant",
            "lower-primary-tutor"
    );
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final int CONFIDENCE_TUTOR_CHAT = 50;

    private final AssessmentEvidenceClient evidenceClient;

    public AgentEvidenceWritebackService(AssessmentEvidenceClient evidenceClient) {
        this.evidenceClient = evidenceClient;
    }

    /** 仅同步成功且能归因到知识点（服务端 enrich 出的 focusCode）的教学对话会写证据。 */
    public void recordTutorChat(AgentRun run, Map<String, Object> context) {
        if (run == null || !EVIDENCE_AGENT_CODES.contains(run.getAgentCode())) {
            return;
        }
        if (!"SUCCEEDED".equals(run.getStatus()) || !StringUtils.hasText(run.getOutputText())) {
            return;
        }
        Object focus = context == null ? null : context.get("focusCode");
        if (!(focus instanceof String knowledgeCode) || !StringUtils.hasText(knowledgeCode)) {
            return;
        }
        EvidenceWritebackRequest request = new EvidenceWritebackRequest(
                run.getUserId(),
                knowledgeCode,
                "TUTOR_CHAT",
                titleOf(run),
                run.getRunId(),
                null,
                CONFIDENCE_TUTOR_CHAT,
                "{\"durationMs\":" + defaultLong(run.getDurationMs()) + "}",
                run.getFinishedTime()
        );
        try {
            ApiResponse<Void> response = evidenceClient.record(request);
            if (response == null || response.code() != 200) {
                log.warn("教学证据写回被拒绝 runId={} code={}",
                        run.getRunId(), response == null ? "null" : response.code());
            }
        } catch (Exception exception) {
            log.warn("教学证据写回失败 runId={}：{}", run.getRunId(), exception.getMessage());
        }
    }

    /** 用学生的提问作证据标题，压缩空白并截断，避免多行长标题撑爆列表。 */
    private String titleOf(AgentRun run) {
        String title = WHITESPACE.matcher(StringUtils.hasText(run.getInputText())
                ? run.getInputText().trim() : "教学对话").replaceAll(" ");
        return title.length() <= 64 ? title : title.substring(0, 64);
    }

    private long defaultLong(Long value) {
        return value == null ? 0L : value;
    }
}
