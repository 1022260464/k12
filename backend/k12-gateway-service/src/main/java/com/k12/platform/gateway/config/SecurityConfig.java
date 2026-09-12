package com.k12.platform.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.common.security.K12JwtClaimsValidator;
import com.k12.platform.common.security.K12JwtConfigurationValidator;
import com.k12.platform.common.security.K12JwtProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.context.NoOpServerSecurityContextRepository;
import reactor.core.publisher.Mono;

/*
 * Gateway 使用 WebFlux 安全链统一验证 JWT。
 *
 * Spring Cloud Gateway 基于 Reactor/WebFlux，因此这里使用 ServerHttpSecurity，
 * 不能复用 Servlet 项目中的 HttpSecurity。两套 API 写法不同，但安全目标相同：
 * 登录和注册匿名放行，其余业务请求必须携带有效 Bearer Token。
 */
@Configuration
@EnableWebFluxSecurity
@EnableConfigurationProperties(K12JwtProperties.class)
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, ObjectMapper objectMapper) {
        /*
         * AuthenticationEntryPoint 专门处理“认证失败”：无 Token、Token 过期、签名错误等。
         * 它返回 401；有合法 Token 但权限不足由 AccessDeniedHandler 返回 403。
         */
        ServerAuthenticationEntryPoint authenticationEntryPoint = (exchange, exception) -> {
            log.info(
                    "Gateway authentication rejected, method={}, path={}, reason={}",
                    exchange.getRequest().getMethod(),
                    exchange.getRequest().getPath().value(),
                    exception.getMessage()
            );
            return GatewaySecurityErrorWriter.write(
                    exchange,
                    objectMapper,
                    HttpStatus.UNAUTHORIZED,
                    "未登录、登录已过期或令牌无效"
            );
        };
        /* 每个链式方法都在配置同一条 WebFlux 安全过滤链，最后 build() 才创建对象。 */
        return http
                /* JWT 放在 Authorization 请求头，不依赖 Cookie，所以当前纯 API 模式关闭 CSRF。 */
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                /* 不使用 Spring 自动生成的网页表单登录，也不继续使用 HTTP Basic。 */
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                /* Bearer Token 每次独立验证，不把登录状态保存在 WebSession。 */
                .securityContextRepository(NoOpServerSecurityContextRepository.getInstance())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler((exchange, exception) -> {
                            log.info(
                                    "Gateway access denied, method={}, path={}, reason={}",
                                    exchange.getRequest().getMethod(),
                                    exchange.getRequest().getPath().value(),
                                    exception.getMessage()
                            );
                            return GatewaySecurityErrorWriter.write(
                                    exchange,
                                    objectMapper,
                                    HttpStatus.FORBIDDEN,
                                    "没有访问该资源的权限"
                            );
                        })
                )
                .authorizeExchange(exchanges -> exchanges
                        /* permitAll 仅允许请求进入登录/健康接口，不代表自动认证成功。 */
                        .pathMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/api/v1/gateway/health",
                                "/api/v1/iam/health",
                                "/api/v1/learning/health",
                                "/api/v1/agents/health",
                                "/api/v1/assessments/health",
                                "/api/v1/iam/auth/login",
                                "/api/v1/iam/auth/register"
                        ).permitAll()
                        /*
                         * hasAnyAuthority(A, B) 表示当前令牌拥有 A 或 B 任意一个即可。
                         * ROLE_ADMIN 是管理员兜底；user:read 是可单独分配的细粒度权限。
                         */
                        .pathMatchers(HttpMethod.GET, "/api/v1/iam/users/me/learning-profile").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.LEARNING_PROFILE_READ)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/iam/users/me/learning-profile").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.LEARNING_PROFILE_UPDATE)
                        .pathMatchers(HttpMethod.POST, "/api/v1/iam/users/students/validate").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_READ)
                        .pathMatchers(HttpMethod.POST, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/iam/users/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.USER_DELETE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/iam/roles/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.ROLE_READ)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/iam/roles/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.ROLE_UPDATE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_READ)
                        .pathMatchers(HttpMethod.POST, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/learning/courses/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.COURSE_DELETE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_READ)
                        .pathMatchers(HttpMethod.POST, "/api/v1/agents/*/runs").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_INVOKE)
                        .pathMatchers(HttpMethod.POST, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_DELETE)
                        .pathMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/submit").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_SUBMIT)
                        .pathMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/grade").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/submissions/*/grade-history").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_GRADE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/*/recipients").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .pathMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/*/publish", "/api/v1/assessments/homeworks/*/close").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_READ)
                        .pathMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_DELETE)
                        /* 没有单独声明的新接口默认也必须登录，避免新增接口意外匿名暴露。 */
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(resourceServer -> resourceServer
                        /* 开启 Bearer Token 资源服务器能力：从 Authorization 请求头读取 JWT。 */
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                )
                .build();
    }

    @Bean
    public ReactiveJwtDecoder reactiveJwtDecoder(K12JwtProperties properties) {
        /*
         * Decoder 做两类工作：
         * 1. 用 HS256 密钥验证签名，证明 Token 未被篡改；
         * 2. 调用下面的 validators 校验时间、issuer 和业务 claims。
         */
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withSecretKey(properties.secretKey()).build();
        /* createDefaultWithIssuer 同时包含标准时间校验和 iss 校验。 */
        OAuth2TokenValidator<Jwt> issuerValidator =
                JwtValidators.createDefaultWithIssuer(properties.getIssuer());
        /* Delegating 表示两个校验器必须全部成功。 */
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                issuerValidator,
                new K12JwtClaimsValidator()
        ));
        return decoder;
    }

    @Bean
    public K12JwtConfigurationValidator k12JwtConfigurationValidator(
            K12JwtProperties properties,
            Environment environment
    ) {
        return new K12JwtConfigurationValidator(properties, environment);
    }

    private Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        /*
         * 默认 Spring 会读取 scope/scp，并添加 SCOPE_ 前缀。
         * 本项目把权限放在 authorities claim，所以必须明确告诉转换器读取该字段。
         */
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("authorities");
        /* 保留数据库中的原值：ROLE_ADMIN、course:read，不额外添加 SCOPE_。 */
        authoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter delegate = new JwtAuthenticationConverter();
        delegate.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        /* 普通转换器是同步 API，Adapter 把它适配成 WebFlux 需要的 Mono。 */
        return new ReactiveJwtAuthenticationConverterAdapter(delegate);
    }
}
