package com.k12.platform.iam.security;

import com.k12.platform.common.security.K12JwtProperties;
import com.k12.platform.iam.dto.LoginResponse;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/*
 * JWT 签发服务。
 *
 * JWT 中只放用户标识和权限，不放密码、密码哈希等敏感信息。
 * authorities 同时包含 ROLE_ADMIN 这类角色和 user:read 这类细粒度权限。
 */
@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final K12JwtProperties jwtProperties;

    public JwtTokenService(JwtEncoder jwtEncoder, K12JwtProperties jwtProperties) {
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    public LoginResponse createAccessToken(
            Long userId,
            String username,
            List<String> authorities
    ) {
        /* iat/exp 使用 Instant，JWT 中最终保存为 Unix 时间。 */
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(jwtProperties.getAccessTokenTtl());
        /* 去重并排序，使同一组权限生成的 claim 顺序稳定，便于调试。 */
        List<String> normalizedAuthorities = authorities.stream()
                .distinct()
                .sorted()
                .toList();

        /*
         * JWT Payload（载荷）：
         * iss       签发者，用于防止接受其他系统的令牌；
         * iat/exp   签发时间和过期时间；
         * sub       当前用户名；
         * userId    数据权限使用的数据库用户 ID；
         * authorities 角色和功能权限，用于 hasAuthority 判断。
         */
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.getIssuer())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(username)
                .claim("userId", userId.toString())
                .claim("authorities", normalizedAuthorities)
                .build();
        /* Header 声明 HS256；encode 会用服务端密钥计算签名，防止客户端篡改载荷。 */
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        return new LoginResponse(
                token,
                "Bearer",
                jwtProperties.getAccessTokenTtl().toSeconds(),
                username,
                normalizedAuthorities
        );
    }
}
