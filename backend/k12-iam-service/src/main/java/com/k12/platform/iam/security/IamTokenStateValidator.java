package com.k12.platform.iam.security;

import com.k12.platform.common.security.K12TokenStateValidator;
import com.k12.platform.iam.mapper.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/** IAM 直接使用数据库校验令牌，避免调用自己形成 HTTP 循环。 */
@Component
public class IamTokenStateValidator implements K12TokenStateValidator {

    private final UserMapper userMapper;

    public IamTokenStateValidator(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public ValidationResult validate(Jwt jwt, HttpServletRequest request) {
        Long userId = parseLong(jwt.getClaimAsString("userId"));
        Object versionClaim = jwt.getClaim("authVersion");
        Long authVersion = versionClaim instanceof Number number ? number.longValue() : null;
        if (userId == null || authVersion == null) {
            return ValidationResult.INVALID;
        }
        return userMapper.isTokenStateValid(userId, authVersion)
                ? ValidationResult.VALID
                : ValidationResult.INVALID;
    }

    private Long parseLong(String value) {
        try {
            return value == null ? null : Long.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
