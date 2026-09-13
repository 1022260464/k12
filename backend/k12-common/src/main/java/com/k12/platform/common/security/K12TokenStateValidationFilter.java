package com.k12.platform.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/** 在 JWT 验签成功后继续检查账号状态和认证版本。 */
public class K12TokenStateValidationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(K12TokenStateValidationFilter.class);

    private final ObjectProvider<K12TokenStateValidator> validatorProvider;
    private final ObjectMapper objectMapper;

    public K12TokenStateValidationFilter(
            ObjectProvider<K12TokenStateValidator> validatorProvider,
            ObjectMapper objectMapper
    ) {
        this.validatorProvider = validatorProvider;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        K12TokenStateValidator validator = validatorProvider.getIfAvailable();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || validator == null) {
            filterChain.doFilter(request, response);
            return;
        }

        K12TokenStateValidator.ValidationResult result =
                validator.validate(jwtAuthentication.getToken(), request);
        if (result == K12TokenStateValidator.ValidationResult.VALID) {
            filterChain.doFilter(request, response);
            return;
        }

        SecurityContextHolder.clearContext();
        if (result == K12TokenStateValidator.ValidationResult.UNAVAILABLE) {
            log.warn("Token state service unavailable, method={}, uri={}, subject={}",
                    request.getMethod(), request.getRequestURI(), jwtAuthentication.getToken().getSubject());
            K12SecurityErrorWriter.write(response, objectMapper, 503, "认证状态服务暂时不可用");
            return;
        }
        log.info("Token state rejected, method={}, uri={}, subject={}",
                request.getMethod(), request.getRequestURI(), jwtAuthentication.getToken().getSubject());
        K12SecurityErrorWriter.write(response, objectMapper, 401, "登录状态已失效，请重新登录");
    }
}
