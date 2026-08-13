package com.k12.platform.common.security;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;

import java.util.Arrays;

/*
 * 启动时检查 JWT 基础配置。
 * 开发环境可以使用仓库里的默认密钥；prod 环境必须显式设置 K12_JWT_SECRET。
 */
public class K12JwtConfigurationValidator implements ApplicationRunner {

    private final K12JwtProperties properties;
    private final Environment environment;

    public K12JwtConfigurationValidator(K12JwtProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (properties.getIssuer() == null || properties.getIssuer().isBlank()) {
            throw new IllegalStateException("k12.security.jwt.issuer must not be blank");
        }
        if (properties.getAccessTokenTtl() == null
                || properties.getAccessTokenTtl().isZero()
                || properties.getAccessTokenTtl().isNegative()) {
            throw new IllegalStateException("k12.security.jwt.access-token-ttl must be positive");
        }
        properties.secretKey();
        boolean production = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
        if (production && K12JwtProperties.DEFAULT_DEVELOPMENT_SECRET.equals(properties.getSecret())) {
            throw new IllegalStateException("Production profile requires a custom K12_JWT_SECRET");
        }
    }
}
