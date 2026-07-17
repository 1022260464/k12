package com.k12.platform.agent.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.model.ServiceDescriptor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agents")
public class AgentHealthController {
//todo 通用接口
    @GetMapping("/health")
    public ApiResponse<ServiceDescriptor> health() {
        return ApiResponse.ok(new ServiceDescriptor(
                "agent",
                "K12 Agent Service",
                "多智能体教学编排、对话上下文、工具调用和教学策略域。",
                List.of("agent-orchestration", "conversation-context", "teaching-strategy", "tool-calling")
        ));
    }
}
