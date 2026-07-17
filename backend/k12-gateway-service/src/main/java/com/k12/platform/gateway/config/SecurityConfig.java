package com.k12.platform.gateway.config;

import com.k12.platform.common.security.K12SecurityProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.userdetails.MapReactiveUserDetailsService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.server.SecurityWebFilterChain;

/*
 * Gateway 的 Spring Security 配置。
 *
 * Gateway 使用 Spring Cloud Gateway，底层是 WebFlux 响应式栈。
 * 它不能使用普通业务服务里的 HttpSecurity / SecurityFilterChain，
 * 必须使用 ServerHttpSecurity / SecurityWebFilterChain。
 */
@Configuration
@EnableWebFluxSecurity
@EnableConfigurationProperties(K12SecurityProperties.class)
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, K12SecurityProperties properties) {
        return http
                /*
                 * Gateway 主要处理 API 请求，不处理传统服务端表单。
                 * 这里先关闭 CSRF，避免非 GET 请求被 CSRF Token 拦截。
                 */
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                /*
                 * 关闭默认登录页面。
                 * 前后端分离项目通常由前端自己提供登录页。
                 */
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                /*
                 * 启用 HTTP Basic，方便开发阶段快速验证认证流程。
                 */
                .httpBasic(Customizer.withDefaults())
                .authorizeExchange(exchanges -> exchanges
                        /*
                         * 公共放行路径来自 k12-common 的 K12SecurityProperties。
                         */
                        .pathMatchers(properties.getPermitPaths().toArray(String[]::new)).permitAll()
                        /*
                         * Gateway 上除放行路径外的所有请求都需要认证。
                         */
                        .anyExchange().authenticated()
                )
                .build();
    }

    @Bean
    /*
     * WebFlux 使用响应式用户服务。
     * 这里和普通业务服务一样，先读取 k12.security.user.* 作为开发账号。
     */
    public MapReactiveUserDetailsService userDetailsService(
            K12SecurityProperties properties,
            PasswordEncoder passwordEncoder
    ) {
        K12SecurityProperties.User securityUser = properties.getUser();
        return new MapReactiveUserDetailsService(User.withUsername(securityUser.getName())
                /*
                 * 不把明文密码直接交给 Spring Security，而是先用 BCrypt 编码。
                 */
                .password(passwordEncoder.encode(securityUser.getPassword()))
                .roles(securityUser.getRoles().toArray(String[]::new))
                .build());
    }

    @Bean
    /*
     * Gateway 这边也需要一个密码编码器。
     */
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
