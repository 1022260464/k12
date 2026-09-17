package com.k12.platform.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * 校验一个已经通过签名验证的 JWT 是否仍然代表有效登录状态。
 *
 * JWT 本身是无状态的，仅验证签名无法感知账号被禁用、密码被修改等变化。
 * IAM 使用数据库实现本接口，其他业务服务通过 IAM 的 token-state 接口实现。
 */
public interface K12TokenStateValidator {

    ValidationResult validate(Jwt jwt, HttpServletRequest request);

    enum ValidationResult {
        VALID,
        INVALID,
        UNAVAILABLE
    }
}
