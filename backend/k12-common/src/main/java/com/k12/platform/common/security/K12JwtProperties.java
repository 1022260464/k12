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

    /*
     * 仅供本地开发启动使用的默认密钥。
     * 它已经出现在代码仓库中，因此不能当作生产密钥。
     */
    public static final String DEFAULT_DEVELOPMENT_SECRET =
            "k12-platform-dev-secret-change-me-2026-very-long-key";

    /* iss：令牌签发者。验签服务会拒绝其他系统签发的令牌。 */
    private String issuer = "k12-platform";
    /* HS256 对称密钥：IAM 用它签名，Gateway 和业务服务用同一个密钥验签。 */
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
        /*
         * SecretKeySpec 只是把配置字符串包装成 Java 密钥对象，不是在这里加密 JWT。
         * 真正的签名由 NimbusJwtEncoder 完成，验签由 NimbusJwtDecoder 完成。
         */
        return new SecretKeySpec(keyBytes, "HmacSHA256");
    }
}
