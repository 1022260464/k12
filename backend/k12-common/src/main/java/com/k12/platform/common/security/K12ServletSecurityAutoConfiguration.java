package com.k12.platform.common.security;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/*
 * 普通业务服务的 Spring Security 自动配置。
 *
 * iam-service、learning-service、agent-service、assessment-service 使用的是
 * spring-boot-starter-web，也就是 Servlet 栈，所以这里使用 HttpSecurity
 * 和 SecurityFilterChain。
 */
@AutoConfiguration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
@EnableConfigurationProperties(K12SecurityProperties.class)
public class K12ServletSecurityAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(K12ServletSecurityAutoConfiguration.class);

    @Bean
    @ConditionalOnMissingBean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, K12SecurityProperties properties) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .formLogin(formLogin -> formLogin.disable())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, authException) -> {
                            log.info(
                                    "Authentication rejected, method={}, uri={}, reason={}",
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    authException.getMessage()
                            );
                            response.addHeader("WWW-Authenticate", "Basic realm=\"Realm\"");
                            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                        })
                )
                .httpBasic(Customizer.withDefaults())
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(properties.getPermitPaths().toArray(String[]::new)).permitAll()
                        .anyRequest().authenticated()
                )
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public UserDetailsService userDetailsService(K12SecurityProperties properties, PasswordEncoder passwordEncoder) {
        K12SecurityProperties.User securityUser = properties.getUser();
        return new InMemoryUserDetailsManager(User.withUsername(securityUser.getName())
                .password(passwordEncoder.encode(securityUser.getPassword()))
                .roles(securityUser.getRoles().toArray(String[]::new))
                .build());
    }

    @Bean
    @ConditionalOnMissingBean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    @ConditionalOnMissingBean(name = "k12AuthenticationFailureListener")
    public ApplicationListener<AbstractAuthenticationFailureEvent> k12AuthenticationFailureListener() {
        return event -> {
            Object principal = event.getAuthentication() == null
                    ? "unknown"
                    : event.getAuthentication().getPrincipal();
            String reason = event.getException() == null
                    ? "unknown"
                    : event.getException().getMessage();

            log.info("Authentication failed, principal={}, reason={}", principal, reason);
        };
    }
}
