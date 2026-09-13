package com.k12.platform.iam.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.iam.dto.AuditPageResponse;
import com.k12.platform.iam.dto.LoginAuditResponse;
import com.k12.platform.iam.dto.OperationAuditResponse;
import com.k12.platform.iam.mapper.LoginAuditMapper;
import com.k12.platform.iam.mapper.OperationAuditMapper;
import com.k12.platform.iam.model.LoginAudit;
import com.k12.platform.iam.model.OperationAudit;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

/** 审计只允许管理员分页读取，避免普通用户枚举账号和管理行为。 */
@Service
public class AuditQueryService {

    private final LoginAuditMapper loginAuditMapper;
    private final OperationAuditMapper operationAuditMapper;

    public AuditQueryService(LoginAuditMapper loginAuditMapper, OperationAuditMapper operationAuditMapper) {
        this.loginAuditMapper = loginAuditMapper;
        this.operationAuditMapper = operationAuditMapper;
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public AuditPageResponse<LoginAuditResponse> loginAudits(int page, int size) {
        Range range = range(page, size);
        var rows = loginAuditMapper.selectList(Wrappers.<LoginAudit>lambdaQuery()
                .orderByDesc(LoginAudit::getId)
                .last("LIMIT " + range.size + " OFFSET " + range.offset()));
        return new AuditPageResponse<>(rows.stream().map(this::toResponse).toList(),
                range.page, range.size, loginAuditMapper.selectCount(null));
    }

    @PreAuthorize("hasAuthority('" + K12Authorities.ROLE_ADMIN + "')")
    public AuditPageResponse<OperationAuditResponse> operationAudits(int page, int size) {
        Range range = range(page, size);
        var rows = operationAuditMapper.selectList(Wrappers.<OperationAudit>lambdaQuery()
                .orderByDesc(OperationAudit::getId)
                .last("LIMIT " + range.size + " OFFSET " + range.offset()));
        return new AuditPageResponse<>(rows.stream().map(this::toResponse).toList(),
                range.page, range.size, operationAuditMapper.selectCount(null));
    }

    private Range range(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page 必须大于 0，size 必须在 1 到 100 之间");
        }
        return new Range(page, size);
    }

    private LoginAuditResponse toResponse(LoginAudit audit) {
        return new LoginAuditResponse(audit.getId(), audit.getUserId(), audit.getUsername(),
                Integer.valueOf(1).equals(audit.getSuccess()), audit.getFailureReason(),
                audit.getClientIp(), audit.getUserAgent(), audit.getCreatedTime());
    }

    private OperationAuditResponse toResponse(OperationAudit audit) {
        return new OperationAuditResponse(audit.getId(), audit.getOperatorUserId(), audit.getAction(),
                audit.getTargetType(), audit.getTargetId(), audit.getDetail(), audit.getCreatedTime());
    }

    private record Range(int page, int size) {
        int offset() {
            return (page - 1) * size;
        }
    }
}
