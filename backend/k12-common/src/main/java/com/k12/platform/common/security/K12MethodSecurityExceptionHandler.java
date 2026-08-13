package com.k12.platform.common.security;

import com.k12.platform.common.api.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/*
 * 处理 Service 层 @PreAuthorize 抛出的异常。
 * Filter 层和方法层都返回相同的 code/message/data/timestamp 结构。
 */
@RestControllerAdvice
public class K12MethodSecurityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(K12MethodSecurityExceptionHandler.class);

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnauthenticated(
            AuthenticationCredentialsNotFoundException exception
    ) {
        log.info("Method security rejected unauthenticated request, reason={}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.fail(401, "未登录、登录已过期或令牌无效"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException exception) {
        log.info("Method security denied request, reason={}", exception.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.fail(403, "没有访问该资源的权限"));
    }
}
