package com.k12.platform.iam.service;

import com.k12.platform.common.security.K12SecurityContext;
import com.k12.platform.iam.mapper.OperationAuditMapper;
import com.k12.platform.iam.model.OperationAudit;
import org.springframework.stereotype.Service;

/** 与当前业务事务一起写入管理员操作审计，业务回滚时审计也回滚。 */
@Service
public class OperationAuditService {

    private final OperationAuditMapper mapper;

    public OperationAuditService(OperationAuditMapper mapper) {
        this.mapper = mapper;
    }

    public void record(String action, String targetType, Object targetId, String detail) {
        OperationAudit audit = new OperationAudit();
        audit.setOperatorUserId(K12SecurityContext.currentUserId().orElse(null));
        audit.setAction(action);
        audit.setTargetType(targetType);
        audit.setTargetId(targetId == null ? null : targetId.toString());
        audit.setDetail(detail);
        mapper.insert(audit);
    }
}
