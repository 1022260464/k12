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

/* 校验数据库用户凭据，成功后交给 JwtTokenService 签发访问令牌。 */
@Service
public class AuthenticationService {

    private final UserAuthenticationService userAuthenticationService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final String dummyPasswordHash;

    public AuthenticationService(
            UserAuthenticationService userAuthenticationService,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this.userAuthenticationService = userAuthenticationService;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        /*
         * 用户不存在时仍执行一次 BCrypt，减小通过响应耗时判断用户名是否存在的风险。
         * 这个哈希只参与耗时填充，不会对应任何真实账号。
         */
        this.dummyPasswordHash = passwordEncoder.encode("k12-dummy-password-never-used");
    }

    public LoginResponse login(LoginRequest request) {
        UserAuthenticationService.AuthenticatedUser user;
        try {
            user = userAuthenticationService.loadByUsername(request.username());
        } catch (UsernameNotFoundException exception) {
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            throw new BadCredentialsException("Username or password is incorrect");
        }
        /* 先校验密码再检查状态，使各种登录失败都至少执行一次 BCrypt。 */
        if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
            throw new BadCredentialsException("Username or password is incorrect");
        }
        if (user.status() == 0) {
            throw new DisabledException("Account is disabled");
        }
        if (user.status() == 2) {
            throw new LockedException("Account is locked");
        }
        if (user.authorities().stream().noneMatch(authority -> authority.startsWith("ROLE_"))) {
            throw new DisabledException("Account has no active role");
        }
        return jwtTokenService.createAccessToken(
                user.id(),
                user.username(),
                user.authorities()
        );
    }
}
