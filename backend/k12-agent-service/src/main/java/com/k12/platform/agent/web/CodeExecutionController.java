package com.k12.platform.agent.web;

import com.k12.platform.agent.client.dto.RuntimeArtifactResponse;
import com.k12.platform.agent.client.dto.RuntimeCodeExecutionResponse;
import com.k12.platform.agent.dto.CodeExecutionArtifactResponse;
import com.k12.platform.agent.dto.CodeExecutionRequest;
import com.k12.platform.agent.dto.CodeExecutionResponse;
import com.k12.platform.agent.service.CodeExecutionService;
import com.k12.platform.agent.service.CodeExecutionOutcome;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

/** 面向登录用户的代码执行入口，用户代码最终只会在隔离沙箱中运行。 */
@RestController
@RequestMapping("/api/v1/agents/code-executions")
public class CodeExecutionController {

    private final CodeExecutionService executionService;

    public CodeExecutionController(CodeExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CodeExecutionResponse>> execute(
            @Valid @RequestBody CodeExecutionRequest request
    ) {
        CodeExecutionOutcome outcome = executionService.execute(
                request.code(),
                request.timeoutSeconds(),
                request.executionMode()
        );
        HttpStatus status = "PENDING".equals(outcome.execution().status())
                ? HttpStatus.ACCEPTED
                : HttpStatus.OK;
        return ResponseEntity.status(status).body(ApiResponse.ok(toResponse(outcome)));
    }

    private CodeExecutionResponse toResponse(CodeExecutionOutcome outcome) {
        RuntimeCodeExecutionResponse source = outcome.execution();
        List<RuntimeArtifactResponse> runtimeArtifacts = source.artifacts() == null
                ? List.of()
                : source.artifacts();
        return new CodeExecutionResponse(
                outcome.runId(),
                source.executionId(),
                source.status(),
                source.stdout(),
                source.stderr(),
                runtimeArtifacts.stream().map(this::toArtifactResponse).toList(),
                source.exitCode(),
                source.durationMs()
        );
    }

    private CodeExecutionArtifactResponse toArtifactResponse(RuntimeArtifactResponse source) {
        return new CodeExecutionArtifactResponse(
                source.artifactId(),
                source.kind(),
                source.title(),
                source.mimeType(),
                source.uri(),
                source.payload()
        );
    }
}
