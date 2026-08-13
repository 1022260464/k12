package com.k12.platform.iam.config;

import com.k12.platform.common.security.K12JwtProperties;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/* IAM 独有配置：只有身份服务负责签发 JWT。 */
@Configuration
public class JwtEncoderConfiguration {

    @Bean
    public JwtEncoder jwtEncoder(K12JwtProperties jwtProperties) {
        /*
         * @Bean 的返回对象由 Spring 容器管理，之后会自动注入 JwtTokenService。
         * ImmutableSecret 保存 HS256 对称密钥；只有 IAM 需要 Encoder，因为只有 IAM 发令牌。
         */
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtProperties.secretKey()));
    }
}
