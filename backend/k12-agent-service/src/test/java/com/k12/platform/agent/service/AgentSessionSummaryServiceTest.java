package com.k12.platform.agent.service;

import com.k12.platform.agent.client.AgentRuntimeSummaryClient;
import com.k12.platform.agent.client.dto.RuntimeConversationSummaryRequest;
import com.k12.platform.agent.client.dto.RuntimeConversationSummaryResponse;
import com.k12.platform.agent.mapper.AgentRunMapper;
import com.k12.platform.agent.mapper.AgentSessionSummaryMapper;
import com.k12.platform.agent.model.AgentRun;
import com.k12.platform.agent.model.AgentSessionSummary;
import com.k12.platform.common.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentSessionSummaryServiceTest {

    @Mock AgentRunMapper runMapper;
    @Mock AgentSessionSummaryMapper summaryMapper;
    @Mock AgentRuntimeSummaryClient summaryClient;

    @Test
    @DisplayName("只把最近六轮之外的未摘要成功问答增量并入滚动摘要")
    void mergesOlderTurnsAndAdvancesCoverage() {
        AgentSessionSummary previous = new AgentSessionSummary();
        previous.setSummaryVersion(2);
        previous.setCoveredRunDbId(10L);
        previous.setSummarizedTurnCount(3);
        previous.setSummaryText("旧摘要");
        when(summaryMapper.findByScope(42L, "teaching-assistant", "session-1"))
                .thenReturn(previous);
        when(runMapper.findSummaryBoundaryRunDbId(42L, "teaching-assistant", "session-1", 6))
                .thenReturn(30L);
        AgentRun first = run(11L, "run-11", "第一问", "第一答");
        AgentRun second = run(12L, "run-12", "第二问", "第二答");
        when(runMapper.findSuccessfulSessionRunsForSummary(
                42L, "teaching-assistant", "session-1", 10L, 30L, 20))
                .thenReturn(List.of(first, second));
        when(summaryClient.summarize(any())).thenReturn(ApiResponse.ok(
                new RuntimeConversationSummaryResponse("整合后的摘要", "qwen-test")));
        when(summaryMapper.advanceIfVersion(
                42L, "teaching-assistant", "session-1", 2,
                "整合后的摘要", 12L, "run-12", 5))
                .thenReturn(1);

        AgentSessionSummaryService service = new AgentSessionSummaryService(
                runMapper, summaryMapper, summaryClient, Runnable::run, true);
        service.refresh(42L, "teaching-assistant", "session-1");

        ArgumentCaptor<RuntimeConversationSummaryRequest> request =
                ArgumentCaptor.forClass(RuntimeConversationSummaryRequest.class);
        verify(summaryClient).summarize(request.capture());
        assertThat(request.getValue().previousSummary()).isEqualTo("旧摘要");
        assertThat(request.getValue().summarizedTurnCount()).isEqualTo(5);
        assertThat(request.getValue().turns()).extracting(item -> item.user())
                .containsExactly("第一问", "第二问");
        verify(summaryMapper).insertEmptyIfAbsent(
                42L, "teaching-assistant", "session-1");
        verify(summaryMapper).advanceIfVersion(
                42L, "teaching-assistant", "session-1", 2,
                "整合后的摘要", 12L, "run-12", 5);
    }

    @Test
    @DisplayName("摘要模型失败时保留原摘要并记录脱敏失败码")
    void keepsPreviousSummaryWhenModelFails() {
        AgentSessionSummary previous = new AgentSessionSummary();
        previous.setSummaryVersion(1);
        previous.setCoveredRunDbId(4L);
        previous.setSummarizedTurnCount(1);
        when(summaryMapper.findByScope(42L, "teaching-assistant", "session-1"))
                .thenReturn(previous);
        when(runMapper.findSummaryBoundaryRunDbId(42L, "teaching-assistant", "session-1", 6))
                .thenReturn(20L);
        when(runMapper.findSuccessfulSessionRunsForSummary(
                42L, "teaching-assistant", "session-1", 4L, 20L, 20))
                .thenReturn(List.of(run(5L, "run-5", "问", "答")));
        when(summaryClient.summarize(any())).thenReturn(ApiResponse.fail(503, "busy"));

        AgentSessionSummaryService service = new AgentSessionSummaryService(
                runMapper, summaryMapper, summaryClient, Runnable::run, true);
        service.refresh(42L, "teaching-assistant", "session-1");

        verify(summaryMapper).markFailedIfVersion(
                42L, "teaching-assistant", "session-1", 1, "RUNTIME_503");
    }

    private AgentRun run(long id, String runId, String input, String output) {
        AgentRun run = new AgentRun();
        run.setId(id);
        run.setRunId(runId);
        run.setInputText(input);
        run.setOutputText(output);
        return run;
    }
}
