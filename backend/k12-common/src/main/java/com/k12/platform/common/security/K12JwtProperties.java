package com.k12.platform.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/*
 * K12 平台 JWT 的统一配置。
 *
 * IAM 使用这些参数签发令牌，Gateway 和各业务服务使用相同参数验证令牌。
 * 对称密钥至少需要 32 字节；生产环境必须通过 K12_JWT_SECRET 环境变量覆盖默认值。
 */
@ConfigurationProperties(prefix = "k12.security.jwt")
public class K12JwtProperties {

    public static final String DEFAULT_DEVELOPMENT_SECRET =
            "k12-platform-dev-secret-change-me-2026-very-long-key";

    private String issuer = "k12-platform";
    private String secret = DEFAULT_DEVELOPMENT_SECRET;
    /* 短期访问令牌降低账号禁用或权限变更后旧令牌继续可用的时间窗口。 */
    private Duration accessTokenTtl = Duration.ofMinutes(30);

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public Duration getAccessTokenTtl() {
        return accessTokenTtl;
    }

    public void setAccessTokenTtl(Duration accessTokenTtl) {
        this.accessTokenTtl = accessTokenTtl;
    }

    public SecretKey secretKey() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("k12.security.jwt.secret must not be blank");
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("k12.security.jwt.secret must contain at least 32 bytes");
        }
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }
}
