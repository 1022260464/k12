package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.LoginRequest;
import com.k12.platform.iam.dto.LoginResponse;
import com.k12.platform.iam.security.JwtTokenService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import java.time.Instant;

/* 校验数据库用户凭据，成功后交给 JwtTokenService 签发访问令牌。 */
@Service
public class AuthenticationService {

    private final UserAuthenticationService userAuthenticationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final LoginAttemptService loginAttemptService;
    private final String dummyPasswordHash;

    public AuthenticationService(
            UserAuthenticationService userAuthenticationService,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            LoginAttemptService loginAttemptService
    ) {
        this.userAuthenticationService = userAuthenticationService;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.loginAttemptService = loginAttemptService;
        /*
         * 用户不存在时仍执行一次 BCrypt，减小通过响应耗时判断用户名是否存在的风险。
         * 这个哈希只参与耗时填充，不会对应任何真实账号。
         */
        this.dummyPasswordHash = passwordEncoder.encode("k12-dummy-password-never-used");
    }

    public LoginResponse login(LoginRequest request) {
        return login(request, null, null);
    }

    public LoginResponse login(LoginRequest request, String clientIp, String userAgent) {
        /*
         * 登录顺序：查数据库用户 -> BCrypt 比对 -> 检查状态和角色 -> 签发 JWT。
         * 登录接口本身不依赖 Security 的表单登录，而是由本项目显式实现。
         */
        UserAuthenticationService.AuthenticatedUser user;
        try {
            user = userAuthenticationService.loadByUsername(request.username());
        } catch (UsernameNotFoundException exception) {
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            loginAttemptService.recordFailure(null, request.username(), "BAD_CREDENTIALS",
                    clientIp, userAgent, false);
            throw new BadCredentialsException("Username or password is incorrect");
        }
        /* 先校验密码再检查状态，使各种登录失败都至少执行一次 BCrypt。 */
        /* matches(明文, 数据库哈希)；绝不能把明文再 encode 后用字符串相等比较。 */
        if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
            loginAttemptService.recordFailure(user.id(), user.username(), "BAD_CREDENTIALS",
                    clientIp, userAgent, true);
            throw new BadCredentialsException("Username or password is incorrect");
        }
        if (user.status() == 0) {
            loginAttemptService.recordFailure(user.id(), user.username(), "DISABLED",
                    clientIp, userAgent, false);
            throw new DisabledException("Account is disabled");
        }
        if (user.status() == 2) {
            loginAttemptService.recordFailure(user.id(), user.username(), "LOCKED",
                    clientIp, userAgent, false);
            throw new LockedException("Account is locked");
        }
        if (user.lockedUntil() != null && user.lockedUntil().isAfter(Instant.now())) {
            loginAttemptService.recordFailure(user.id(), user.username(), "TEMPORARILY_LOCKED",
                    clientIp, userAgent, false);
            throw new LockedException("Account is temporarily locked");
        }
        if (user.authorities().stream().noneMatch(authority -> authority.startsWith("ROLE_"))) {
            loginAttemptService.recordFailure(user.id(), user.username(), "NO_ACTIVE_ROLE",
                    clientIp, userAgent, false);
            throw new DisabledException("Account has no active role");
        }
        loginAttemptService.recordSuccess(user.id(), user.username(), clientIp, userAgent);
        /* 只有前面全部通过，才把数据库查出的真实权限写入 JWT。 */
        return jwtTokenService.createAccessToken(
                user.id(),
                user.username(),
                user.authVersion(),
                user.authorities()
        );
    }
}
