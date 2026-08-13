package com.k12.platform.iam.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.iam.dto.LoginRequest;
import com.k12.platform.iam.dto.LoginResponse;
import com.k12.platform.iam.dto.RegisterRequest;
import com.k12.platform.iam.dto.UserResponse;
import com.k12.platform.iam.service.AuthenticationService;
import com.k12.platform.iam.service.UserService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/* 登录和公开注册入口，由安全配置明确匿名放行。 */
@RestController
@RequestMapping("/api/v1/iam/auth")
public class AuthenticationController {

    private static final Logger log = LoggerFactory.getLogger(AuthenticationController.class);

    private final AuthenticationService authenticationService;
    private final UserService userService;

    public AuthenticationController(AuthenticationService authenticationService, UserService userService) {
        this.authenticationService = authenticationService;
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        /*
         * 此路径在 Gateway 和 Servlet 安全链中 permitAll，表示允许匿名调用；
         * permitAll 不代表跳过账号密码校验，真正的凭据校验仍由 AuthenticationService 完成。
         */
        try {
            return ResponseEntity.ok(ApiResponse.ok(authenticationService.login(request)));
        } catch (AuthenticationException exception) {
            /* 对外统一模糊提示，避免泄露“用户名存在但被锁定”等账号枚举信息。 */
            log.info("JWT login failed, username={}, reason={}", request.username(), exception.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.fail(401, "用户名或密码错误，或账号不可用"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<UserResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(userService.registerStudent(request)));
    }
}
