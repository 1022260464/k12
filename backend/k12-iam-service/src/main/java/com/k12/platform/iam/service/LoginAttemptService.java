package com.k12.platform.iam.service;

import com.k12.platform.iam.config.IamAuthenticationProperties;
import com.k12.platform.iam.mapper.LoginAuditMapper;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.LoginAudit;
import com.k12.platform.iam.model.SysUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** 登录计数和登录审计使用独立事务，认证失败抛异常时也必须提交。 */
@Service
public class LoginAttemptService {

    private final UserMapper userMapper;
    private final LoginAuditMapper auditMapper;
    private final IamAuthenticationProperties properties;

    public LoginAttemptService(UserMapper userMapper, LoginAuditMapper auditMapper,
                               IamAuthenticationProperties properties) {
        this.userMapper = userMapper;
        this.auditMapper = auditMapper;
        this.properties = properties;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(Long userId, String username, String reason,
                              String clientIp, String userAgent, boolean increaseCounter) {
        if (increaseCounter && userId != null) {
            SysUser user = userMapper.findSecurityUserForUpdate(userId);
            if (user != null && user.getStatus() == 1) {
                int failures = defaultZero(user.getFailedLoginCount()) + 1;
                user.setFailedLoginCount(failures);
                if (failures >= properties.getMaxFailedAttempts()) {
                    user.setLockedUntil(Instant.now().plus(properties.getLockDuration()));
                }
                userMapper.updateById(user);
            }
        }
        insertAudit(userId, username, false, reason, clientIp, userAgent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(Long userId, String username, String clientIp, String userAgent) {
        SysUser user = userMapper.findSecurityUserForUpdate(userId);
        if (user != null) {
            user.setFailedLoginCount(0);
            user.setLockedUntil(null);
            user.setLastLoginTime(Instant.now());
            userMapper.updateById(user);
        }
        insertAudit(userId, username, true, null, clientIp, userAgent);
    }

    private void insertAudit(Long userId, String username, boolean success, String reason,
                             String clientIp, String userAgent) {
        LoginAudit audit = new LoginAudit();
        audit.setUserId(userId);
        audit.setUsername(limit(username, 64));
        audit.setSuccess(success ? 1 : 0);
        audit.setFailureReason(limit(reason, 64));
        audit.setClientIp(limit(clientIp, 64));
        audit.setUserAgent(limit(userAgent, 512));
        auditMapper.insert(audit);
    }

    private int defaultZero(Integer value) {
        return value == null ? 0 : value;
    }

    private String limit(String value, int maxLength) {
        return value == null || value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
