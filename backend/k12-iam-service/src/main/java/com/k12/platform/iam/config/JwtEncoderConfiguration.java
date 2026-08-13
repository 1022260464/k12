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
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtProperties.secretKey()));
    }
}
