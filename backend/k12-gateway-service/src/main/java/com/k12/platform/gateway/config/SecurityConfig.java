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
 * 登录和注册匿名放行，其余业务请求必须携带有效的 Bearer Token。
 */
@Configuration
@EnableWebFluxSecurity
@EnableConfigurationProperties(K12JwtProperties.class)
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, ObjectMapper objectMapper) {
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
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
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
                        .pathMatchers(HttpMethod.POST, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/agents/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.AGENT_DELETE)
                        .pathMatchers(HttpMethod.GET, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_READ)
                        .pathMatchers(HttpMethod.POST, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_CREATE)
                        .pathMatchers(HttpMethod.PUT, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_UPDATE)
                        .pathMatchers(HttpMethod.DELETE, "/api/v1/assessments/homeworks/**").hasAnyAuthority(K12Authorities.ROLE_ADMIN, K12Authorities.HOMEWORK_DELETE)
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(resourceServer -> resourceServer
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                )
                .build();
    }

    @Bean
    public ReactiveJwtDecoder reactiveJwtDecoder(K12JwtProperties properties) {
        NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withSecretKey(properties.secretKey()).build();
        OAuth2TokenValidator<Jwt> issuerValidator =
                JwtValidators.createDefaultWithIssuer(properties.getIssuer());
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
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("authorities");
        authoritiesConverter.setAuthorityPrefix("");

        JwtAuthenticationConverter delegate = new JwtAuthenticationConverter();
        delegate.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return new ReactiveJwtAuthenticationConverterAdapter(delegate);
    }
}
