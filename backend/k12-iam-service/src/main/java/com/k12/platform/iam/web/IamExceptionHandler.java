package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/* IAM 接口统一异常响应，保证前端始终能读取 code、message、data。 */
@RestControllerAdvice(basePackages = "com.k12.platform.iam.web")
public class IamExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(IamExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .orElse("请求参数校验失败");
        return ResponseEntity.badRequest().body(ApiResponse.fail(400, message));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateKey(DuplicateKeyException exception) {
        String detail = exception.getMostSpecificCause() == null
                ? ""
                : String.valueOf(exception.getMostSpecificCause().getMessage());
        log.info("IAM duplicate data rejected, reason={}", detail);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.fail(409, resolveDuplicateMessage(detail)));
    }

    private static String resolveDuplicateMessage(String detail) {
        String text = detail == null ? "" : detail.toLowerCase();
        if (text.contains("uk_sys_user_username")) {
            return "用户名已存在";
        }
        if (text.contains("uk_sys_user_email")) {
            return "邮箱已被使用";
        }
        if (text.contains("uk_sys_user_phone")) {
            return "手机号已被使用";
        }
        return "用户名或邮箱已被使用";
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(400, exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(400, "请求 JSON 格式错误"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> handleResponseStatus(ResponseStatusException exception) {
        int code = exception.getStatusCode().value();
        return ResponseEntity.status(exception.getStatusCode())
                .body(ApiResponse.fail(code, exception.getReason()));
    }
}
