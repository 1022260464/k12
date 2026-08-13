package com.k12.platform.agent.web;

import com.k12.platform.agent.dto.AgentRequest;
import com.k12.platform.agent.dto.AgentResponse;
import com.k12.platform.agent.service.AgentService;
import com.k12.platform.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agents")
public class AgentController {

    private final AgentService agentService;

    public AgentController(AgentService agentService) {
        this.agentService = agentService;
    }

    @GetMapping
    public ApiResponse<List<AgentResponse>> listAgents() {
        return ApiResponse.ok(agentService.listAgents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AgentResponse>> getAgent(@PathVariable Long id) {
        return agentService.getAgent(id)
                .map(agent -> ResponseEntity.ok(ApiResponse.ok(agent)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "Agent not found")));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AgentResponse>> createAgent(@Valid @RequestBody AgentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(agentService.createAgent(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AgentResponse>> updateAgent(
            @PathVariable Long id,
            @Valid @RequestBody AgentRequest request
    ) {
        return agentService.updateAgent(id, request)
                .map(agent -> ResponseEntity.ok(ApiResponse.ok(agent)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.fail(404, "Agent not found")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAgent(@PathVariable Long id) {
        if (!agentService.deleteAgent(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.fail(404, "Agent not found"));
        }
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
