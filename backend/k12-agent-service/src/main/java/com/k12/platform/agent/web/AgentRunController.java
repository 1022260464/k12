package com.k12.platform.agent.web;

import com.k12.platform.agent.dto.AgentArtifactResponse;
import com.k12.platform.agent.dto.ArtifactDownloadUrlResponse;
import com.k12.platform.agent.dto.AgentRunPageResponse;
import com.k12.platform.agent.dto.AgentRunRequest;
import com.k12.platform.agent.dto.AgentRunResponse;
import com.k12.platform.agent.dto.AgentSessionHistoryResponse;
import com.k12.platform.agent.service.AgentRunService;
import com.k12.platform.agent.service.AgentArtifactAccessService;
import com.k12.platform.agent.service.AgentSessionService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/agents")
public class AgentRunController {

    private final AgentRunService runService;
    private final AgentSessionService sessionService;
    private final AgentArtifactAccessService artifactAccessService;

    public AgentRunController(
            AgentRunService runService,
            AgentSessionService sessionService,
            AgentArtifactAccessService artifactAccessService
    ) {
        this.runService = runService;
        this.sessionService = sessionService;
        this.artifactAccessService = artifactAccessService;
    }

    @PostMapping("/{agentCode}/runs")
    public ResponseEntity<ApiResponse<AgentRunResponse>> createRun(
            @PathVariable("agentCode")
            @Pattern(regexp = "[a-z][a-z0-9-]{1,63}", message = "智能体编码格式错误")
            String agentCode,
            @Valid @RequestBody AgentRunRequest request
    ) {
        AgentRunResponse run = runService.createRun(agentCode, request);
        HttpStatus status = "PENDING".equals(run.status()) ? HttpStatus.ACCEPTED : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(ApiResponse.ok(run));
    }

    @GetMapping("/runs")
    public ApiResponse<AgentRunPageResponse> listRuns(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        return ApiResponse.ok(runService.listRuns(page, size));
    }

    @GetMapping("/runs/{runId}")
    public ApiResponse<AgentRunResponse> getRun(
            @PathVariable("runId") @Size(max = 64, message = "运行编号不能超过 64 个字符") String runId
    ) {
        return ApiResponse.ok(runService.getRun(runId));
    }

    @GetMapping("/{agentCode}/sessions/{sessionId}/history")
    public ApiResponse<AgentSessionHistoryResponse> getSessionHistory(
            @PathVariable("agentCode")
            @Pattern(regexp = "[a-z][a-z0-9-]{1,63}", message = "智能体编码格式错误")
            String agentCode,
            @PathVariable("sessionId")
            @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._:-]{0,63}", message = "会话编号格式错误")
            String sessionId,
            @RequestParam(name = "limit", defaultValue = "20") int limit
    ) {
        return ApiResponse.ok(sessionService.getHistory(agentCode, sessionId, limit));
    }

    @GetMapping("/runs/{runId}/artifacts")
    public ApiResponse<List<AgentArtifactResponse>> listArtifacts(
            @PathVariable("runId") @Size(max = 64, message = "运行编号不能超过 64 个字符") String runId
    ) {
        return ApiResponse.ok(runService.listArtifacts(runId));
    }

    @GetMapping("/runs/{runId}/artifacts/{artifactId}/download-url")
    public ApiResponse<ArtifactDownloadUrlResponse> createArtifactDownloadUrl(
            @PathVariable("runId") @Size(max = 64, message = "运行编号不能超过 64 个字符") String runId,
            @PathVariable("artifactId") @Size(max = 64, message = "产物编号不能超过 64 个字符") String artifactId
    ) {
        return ApiResponse.ok(artifactAccessService.createDownloadUrl(runId, artifactId));
    }

    @PostMapping("/runs/{runId}/cancel")
    public ApiResponse<AgentRunResponse> cancelRun(
            @PathVariable("runId") @Size(max = 64) String runId
    ) {
        return ApiResponse.ok(runService.cancelRun(runId));
    }

    @PostMapping("/runs/{runId}/retry")
    public ResponseEntity<ApiResponse<AgentRunResponse>> retryRun(
            @PathVariable("runId") @Size(max = 64) String runId
    ) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.ok(runService.retryRun(runId)));
    }
}
