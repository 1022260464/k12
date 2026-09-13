package com.k12.platform.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class K12JwtClaimsValidatorTest {

    private final K12JwtClaimsValidator validator = new K12JwtClaimsValidator();

    @Test
    void acceptsK12TokenContract() {
        Jwt jwt = jwt("1", "admin", List.of("ROLE_ADMIN", "user:read"));

        assertFalse(validator.validate(jwt).hasErrors());
    }

    @Test
    void rejectsMissingUserId() {
        Jwt jwt = jwt(null, "admin", List.of("ROLE_ADMIN"));

        assertTrue(validator.validate(jwt).hasErrors());
    }

    @Test
    void rejectsTokenWithoutActiveRole() {
        Jwt jwt = jwt("1", "admin", List.of("user:read"));

        assertTrue(validator.validate(jwt).hasErrors());
    }

    @Test
    void rejectsMalformedAuthority() {
        Jwt jwt = jwt("1", "admin", List.of("ROLE_ADMIN", "../../admin"));

        assertTrue(validator.validate(jwt).hasErrors());
    }

    @Test
    void rejectsMissingAuthVersion() {
        Instant issuedAt = Instant.now();
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "HS256")
                .issuedAt(issuedAt).expiresAt(issuedAt.plusSeconds(300)).subject("admin")
                .claim("userId", "1").claim("authorities", List.of("ROLE_ADMIN")).build();
        assertTrue(validator.validate(jwt).hasErrors());
    }

    private Jwt jwt(String userId, String subject, List<String> authorities) {
        Instant issuedAt = Instant.now();
        Jwt.Builder builder = Jwt.withTokenValue("test-token")
                .header("alg", "HS256")
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plusSeconds(300))
                .subject(subject)
                .claim("authVersion", 1L)
                .claim("authorities", authorities);
        if (userId != null) {
            builder.claim("userId", userId);
        }
        return builder.build();
    }
}
