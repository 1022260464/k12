package com.k12.platform.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

/*
 * 当前登录用户工具。
 *
 * 功能权限使用 @PreAuthorize；数据权限需要在业务查询中使用 currentUserId()。
 * 例如学生查询作业提交记录时，SQL 必须增加 student_id = 当前用户 ID。
 */
public final class K12SecurityContext {

    private K12SecurityContext() {
    }

    public static Optional<Long> currentUserId() {
        /* userId 在签发时以字符串写入 JWT，这里读取后转换成业务主键 Long。 */
        return currentJwt().map(jwt -> jwt.getClaimAsString("userId")).map(Long::valueOf);
    }

    public static Optional<String> currentUsername() {
        return currentJwt().map(Jwt::getSubject);
    }

    public static Long requireUserId() {
        /* 业务必须依赖当前用户 ID 时使用该方法；缺失时立即失败，不能悄悄使用 null。 */
        return currentUserId().orElseThrow(() -> new IllegalStateException("Authenticated userId is missing"));
    }

    public static boolean hasAuthority(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(grantedAuthority -> authority.equals(grantedAuthority.getAuthority()));
    }

    private static Optional<Jwt> currentJwt() {
        /*
         * JwtAuthenticationFilter 验证 Bearer Token 成功后，会把 Authentication
         * 放入当前请求线程的 SecurityContextHolder。principal 就是解析后的 Jwt。
         */
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return Optional.empty();
        }
        return authentication.getPrincipal() instanceof Jwt jwt ? Optional.of(jwt) : Optional.empty();
    }
}
