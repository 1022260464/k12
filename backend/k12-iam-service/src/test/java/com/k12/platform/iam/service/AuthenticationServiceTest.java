package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.LoginRequest;
import com.k12.platform.iam.dto.LoginResponse;
import com.k12.platform.iam.security.JwtTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthenticationServiceTest {

    private UserAuthenticationService userAuthenticationService;
    private PasswordEncoder passwordEncoder;
    private JwtTokenService jwtTokenService;
    private LoginAttemptService loginAttemptService;
    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        userAuthenticationService = mock(UserAuthenticationService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtTokenService = mock(JwtTokenService.class);
        loginAttemptService = mock(LoginAttemptService.class);
        when(passwordEncoder.encode(anyString())).thenReturn("dummy-hash");
        authenticationService = new AuthenticationService(
                userAuthenticationService,
                passwordEncoder,
                jwtTokenService,
                loginAttemptService
        );
    }

    @Test
    void issuesJwtForValidUser() {
        UserAuthenticationService.AuthenticatedUser user = new UserAuthenticationService.AuthenticatedUser(
                1L, "admin", "password-hash", 1, 0, null, 1L,
                List.of("ROLE_ADMIN", "user:read")
        );
        LoginResponse expected = new LoginResponse("token", "Bearer", 1800, "admin", user.authorities());
        when(userAuthenticationService.loadByUsername("admin")).thenReturn(user);
        when(passwordEncoder.matches("admin123", "password-hash")).thenReturn(true);
        when(jwtTokenService.createAccessToken(1L, "admin", 1L, user.authorities())).thenReturn(expected);

        LoginResponse response = authenticationService.login(new LoginRequest("admin", "admin123"));

        assertEquals(expected, response);
        verify(loginAttemptService).recordSuccess(1L, "admin", null, null);
    }

    @Test
    void rejectsTemporarilyLockedUserEvenWhenPasswordIsCorrect() {
        UserAuthenticationService.AuthenticatedUser user = new UserAuthenticationService.AuthenticatedUser(
                3L, "locked", "password-hash", 1, 5, Instant.now().plusSeconds(300), 1L,
                List.of("ROLE_STUDENT")
        );
        when(userAuthenticationService.loadByUsername("locked")).thenReturn(user);
        when(passwordEncoder.matches("password", "password-hash")).thenReturn(true);

        assertThrows(LockedException.class,
                () -> authenticationService.login(new LoginRequest("locked", "password")));
        verify(loginAttemptService).recordFailure(3L, "locked", "TEMPORARILY_LOCKED", null, null, false);
    }

    @Test
    void hidesUnknownUsernameAsBadCredentialsAndRunsPasswordCheck() {
        when(userAuthenticationService.loadByUsername("missing"))
                .thenThrow(new UsernameNotFoundException("missing"));

        assertThrows(BadCredentialsException.class,
                () -> authenticationService.login(new LoginRequest("missing", "password")));

        verify(passwordEncoder).matches("password", "dummy-hash");
        verify(jwtTokenService, never()).createAccessToken(1L, "missing", 1L, List.of());
    }

    @Test
    void rejectsUserWithoutActiveRole() {
        UserAuthenticationService.AuthenticatedUser user = new UserAuthenticationService.AuthenticatedUser(
                2L, "orphan", "password-hash", 1, 0, null, 1L, List.of("course:read")
        );
        when(userAuthenticationService.loadByUsername("orphan")).thenReturn(user);
        when(passwordEncoder.matches("password", "password-hash")).thenReturn(true);

        assertThrows(DisabledException.class,
                () -> authenticationService.login(new LoginRequest("orphan", "password")));
    }
}
