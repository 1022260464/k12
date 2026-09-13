package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.AuditPageResponse;
import com.k12.platform.iam.dto.LoginAuditResponse;
import com.k12.platform.iam.dto.OperationAuditResponse;
import com.k12.platform.iam.service.AuditQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/iam/audits")
public class AuditController {
    private final AuditQueryService auditQueryService;

    public AuditController(AuditQueryService auditQueryService) {
        this.auditQueryService = auditQueryService;
    }

    @GetMapping("/logins")
    public ApiResponse<AuditPageResponse<LoginAuditResponse>> logins(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(auditQueryService.loginAudits(page, size));
    }

    @GetMapping("/operations")
    public ApiResponse<AuditPageResponse<OperationAuditResponse>> operations(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(auditQueryService.operationAudits(page, size));
    }
}
