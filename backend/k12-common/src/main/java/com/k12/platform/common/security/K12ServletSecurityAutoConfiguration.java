package com.k12.platform.common.security;

import jakarta.servlet.http.HttpServletResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.expression.WebExpressionAuthorizationManager;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.http.HttpMethod;
import org.springframework.core.env.Environment;

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
/* 开启 @PreAuthorize；没有这个注解，Service 上的权限表达式不会执行。 */
@EnableMethodSecurity
@EnableConfigurationProperties({K12SecurityProperties.class, K12JwtProperties.class, K12TokenStateProperties.class})
public class K12ServletSecurityAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(K12ServletSecurityAutoConfiguration.class);

    @Bean
    /* 业务服务可以自定义 SecurityFilterChain；定义后本默认 Bean 自动让位，避免 Bean 冲突。 */
    @ConditionalOnMissingBean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            K12SecurityProperties properties,
            ObjectMapper objectMapper,
            K12TokenStateValidationFilter tokenStateValidationFilter
    ) throws Exception {
        // 与网关和 CourseStudyService 保持一致，不能只检查 course:read 而遗漏学生角色。
        var studyAccess = new WebExpressionAuthorizationManager(
                "hasAuthority('ROLE_ADMIN') or (hasAuthority('ROLE_STUDENT') and hasAuthority('course:read'))");
        /* 认证失败返回 401；该 lambda 是 AuthenticationEntryPoint 接口的实现。 */
        AuthenticationEntryPoint authenticationEntryPoint = (request, response, exception) -> {
            log.info(
                    "Authentication rejected, method={}, uri={}, reason={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    exception.getMessage()
            );
            K12SecurityErrorWriter.write(
                    response,
                    objectMapper,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "未登录、登录已过期或令牌无效"
            );
        };
        /*
         * SecurityFilterChain 是 Spring Security 的核心拦截链。
         *
         * 一次 HTTP 请求进入 Controller 之前，会先经过这条安全过滤链。
         * 这里统一定义普通业务服务的安全规则：
         * 1. 哪些接口可以匿名访问。
         * 2. 哪些接口必须登录。
         * 3. 使用哪种登录认证方式。
         * 4. 认证失败时如何返回响应和打印日志。
         */
        return http
                /*
                 * 关闭 CSRF 防护。
                 *
                 * CSRF 主要保护传统服务端页面表单，例如浏览器 Cookie + 表单提交。
                 * 当前项目是前后端分离 API 服务，使用 JWT Bearer Token，
                 * 不依赖 Cookie 中的登录会话，所以这里关闭。
                 */
                .csrf(csrf -> csrf.disable())
                /*
                 * 关闭 Spring Security 默认表单登录页。
                 *
                 * 如果不关闭，浏览器访问受保护接口时可能跳到默认登录页面。
                 * 当前后端只提供 API，登录页面后续由 React 前端自己实现。
                 */
                .formLogin(formLogin -> formLogin.disable())
                .httpBasic(httpBasic -> httpBasic.disable())
                /* JWT 每次请求独立验证，不在服务器创建或读取登录 Session。 */
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                /*
                 * 自定义认证失败的返回方式。
                 *
                 * 认证失败包括：
                 * 1. 请求没有携带 Bearer Token。
                 * 2. Token 已过期、签名错误或签发方不正确。
                 *
                 * 这里返回 HTTP 401，并在控制台打印 method、uri 和失败原因，
                 * 方便你开发阶段排查“为什么接口打不通”。
                 */
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            log.info(
                                    "Access denied, method={}, uri={}, reason={}",
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    accessDeniedException.getMessage()
                            );
                            K12SecurityErrorWriter.write(
                                    response,
                                    objectMapper,
                                    HttpServletResponse.SC_FORBIDDEN,
                                    "没有访问该资源的权限"
                            );
                        })
                )
                /*
                 * 启用 JWT Bearer Token。
                 * 前端登录成功后，每次请求携带：Authorization: Bearer <token>。
                 */
                .oauth2ResourceServer(resourceServer -> resourceServer
                        /* JWT 解析失败也走同一个入口，保证错误结构和日志一致。 */
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                )
                /* JWT 验签完成后，再检查账号是否被禁用以及认证版本是否仍然有效。 */
                .addFilterAfter(tokenStateValidationFilter, BearerTokenAuthenticationFilter.class)
                /*
                 * 配置接口访问规则。
                 *
                 * requestMatchers(...).permitAll()
                 * 表示这些路径不需要登录，例如健康检查接口。
                 *
                 * anyRequest().authenticated()
                 * 表示除了上面放行的路径，其余接口全部必须登录。
                 *
                 * 这是一种保守安全策略：默认拦截，明确声明哪些接口放行。
                 */
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(properties.getPermitPaths().toArray(String[]::new)).permitAll()
                        .requestMatchers("/api/v1/iam/auth/login", "/api/v1/iam/auth/register").permitAll()
                        /*
                         * URL 层先按路径和 HTTP 方法做第一轮权限校验；
                         * Service 的 @PreAuthorize 再做第二轮，防止直连服务端口或其他入口绕过。
                         */
                        /* “我的学习档案”是用户自己的数据，必须放在通用用户管理规则之前。 */
                        .requestMatchers(HttpMethod.GET, "/api/v1/iam/users/me/learning-profile").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.LEARNING_PROFILE_READ)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/iam/users/me/learning-profile").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.LEARNING_PROFILE_UPDATE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/iam/users/me/password").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/v1/iam/users/*/password", "/api/v1/iam/users/*/status").hasAuthority(K12Authorities.ROLE_ADMIN)
                        .requestMatchers(HttpMethod.GET, "/api/v1/iam/audits/**").hasAuthority(K12Authorities.ROLE_ADMIN)
                        /* Assessment 仅可校验学生身份，不能读取完整用户资料。 */
                        .requestMatchers(HttpMethod.POST, "/api/v1/iam/users/students/validate").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_READ)
                        .requestMatchers(HttpMethod.POST, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_CREATE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_UPDATE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_DELETE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/iam/roles/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.ROLE_READ)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/iam/roles/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.ROLE_UPDATE)
                        // 报名/退课/进度属于学习行为，必须置于课程管理通配规则之前。
                        .requestMatchers(HttpMethod.GET, "/api/v1/learning/courses/*/enrollment", "/api/v1/learning/courses/*/progress").access(studyAccess)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/learning/courses/*/enrollment", "/api/v1/learning/courses/*/chapters/*/progress").access(studyAccess)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/learning/courses/*/enrollment").access(studyAccess)
                        .requestMatchers(HttpMethod.GET, "/api/v1/learning/leaderboard").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_READ)
                        .requestMatchers(HttpMethod.POST, "/api/v1/learning/courses/*/chapters").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_UPDATE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/learning/courses/*/chapters/*").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_UPDATE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_READ)
                        .requestMatchers(HttpMethod.POST, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_CREATE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_UPDATE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_DELETE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_READ)
                        /* 运行、取消和重试都属于“调用智能体”，必须先于下面的 Agent 配置管理通配规则。 */
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/agents/*/runs",
                                "/api/v1/agents/code-executions",
                                "/api/v1/agents/runs/*/cancel",
                                "/api/v1/agents/runs/*/retry"
                        ).hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_INVOKE)
                        .requestMatchers(HttpMethod.POST, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_CREATE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_UPDATE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_DELETE)
                        /* 特殊动作必须先于通用 /** 规则匹配。 */
                        .requestMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/submit").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_SUBMIT)
                        .requestMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/grade").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions/me/detail").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_READ)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions/*/detail").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/assessments/homeworks/*/submissions/*/answers/*/grade").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/assessments/homeworks/*/questions/*").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions/*/grade-history").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/recipients").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .requestMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/publish", "/api/v1/assessments/homeworks/*/close").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .requestMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_READ)
                        .requestMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_CREATE)
                        .requestMatchers(HttpMethod.PUT, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_DELETE)
                        .anyRequest().authenticated()
                )
                .build();
    }

    @Bean
    @ConditionalOnMissingBean
    public K12TokenStateValidationFilter k12TokenStateValidationFilter(
            ObjectProvider<K12TokenStateValidator> validatorProvider,
            ObjectMapper objectMapper
    ) {
        return new K12TokenStateValidationFilter(validatorProvider, objectMapper);
    }

    @Bean
    @ConditionalOnMissingBean(K12TokenStateValidator.class)
    @ConditionalOnProperty(prefix = "k12.security.token-state", name = "remote-enabled", havingValue = "true")
    public K12TokenStateValidator remoteTokenStateValidator(K12TokenStateProperties properties) {
        return new K12RemoteTokenStateValidator(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    public JwtDecoder jwtDecoder(K12JwtProperties jwtProperties) {
        /* Servlet 服务使用同步 JwtDecoder；Gateway 使用 ReactiveJwtDecoder。 */
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtProperties.secretKey()).build();
        OAuth2TokenValidator<Jwt> issuerValidator =
                JwtValidators.createDefaultWithIssuer(jwtProperties.getIssuer());
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                issuerValidator,
                new K12JwtClaimsValidator()
        ));
        return decoder;
    }

    @Bean
    @ConditionalOnMissingBean
    public K12JwtConfigurationValidator k12JwtConfigurationValidator(
            K12JwtProperties jwtProperties,
            Environment environment
    ) {
        return new K12JwtConfigurationValidator(jwtProperties, environment);
    }

    @Bean
    @ConditionalOnMissingBean
    public K12MethodSecurityExceptionHandler k12MethodSecurityExceptionHandler() {
        return new K12MethodSecurityExceptionHandler();
    }

    private Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        /* 把 JWT 中 authorities 数组转换为 Authentication.getAuthorities()。 */
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("authorities");
        /* 不加默认 SCOPE_ 前缀，否则 course:read 会变成 SCOPE_course:read，注解无法匹配。 */
        authoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return authenticationConverter;
    }

    @Bean
    @ConditionalOnMissingBean
    public PasswordEncoder passwordEncoder() {
        /*
         * PasswordEncoder 负责密码加密和密码匹配。
         *
         * BCrypt 是 Spring Security 常用的密码哈希算法。
         * 数据库里的 sys_user.password_hash 也应该存 BCrypt 哈希值，
         * 不能存 admin123 这种明文密码。
         */
        return new BCryptPasswordEncoder();
    }

}
