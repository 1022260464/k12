package com.k12.platform.common.security;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.regex.Pattern;

/*
 * 校验 K12 平台自己约定的 JWT 字段。
 *
 * Spring Security 默认只校验签名、过期时间和 issuer，无法知道业务代码还依赖
 * userId、authorities。这里将这些字段也变成令牌的强制契约，避免字段缺失的
 * 旧令牌或非本系统签发的令牌进入 Controller。
 */
public final class K12JwtClaimsValidator implements OAuth2TokenValidator<Jwt> {

    private static final Pattern ROLE_PATTERN = Pattern.compile("ROLE_[A-Z][A-Z0-9_]*");
    private static final Pattern PERMISSION_PATTERN =
            Pattern.compile("[a-z][a-z0-9-]*:[a-z][a-z0-9-]*");

    private static final OAuth2Error INVALID_TOKEN = new OAuth2Error(
            "invalid_token",
            "JWT must contain valid userId, subject and authorities claims",
            null
    );

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        Object userId = jwt.getClaims().get("userId");
        Object authorities = jwt.getClaims().get("authorities");

        boolean validUserId = userId instanceof String value && isPositiveLong(value);
        boolean validSubject = jwt.getSubject() != null && !jwt.getSubject().isBlank();
        boolean validAuthorities = authorities instanceof Collection<?> values
                && !values.isEmpty()
                && values.stream().allMatch(this::isValidAuthority)
                && values.stream().anyMatch(value -> value instanceof String text
                        && ROLE_PATTERN.matcher(text).matches());

        if (!validUserId || !validSubject || !validAuthorities) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN);
        }
        return OAuth2TokenValidatorResult.success();
    }

    private boolean isPositiveLong(String value) {
        try {
            return Long.parseLong(value) > 0;
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private boolean isValidAuthority(Object value) {
        if (!(value instanceof String authority)) {
            return false;
        }
        return ROLE_PATTERN.matcher(authority).matches()
                || PERMISSION_PATTERN.matcher(authority).matches();
    }
}
