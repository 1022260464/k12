package com.k12.platform.gateway.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.common.model.ServiceDescriptor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/gateway")
public class GatewayHealthController {

    @GetMapping("/health")
    public ApiResponse<ServiceDescriptor> health() {
        return ApiResponse.ok(new ServiceDescriptor(
                "gateway",
                "K12 Gateway Service",
                "统一入口、路由聚合、跨服务访问控制预留。",
                List.of("edge-routing", "request-entry", "service-aggregation")
        ));
    }
}
