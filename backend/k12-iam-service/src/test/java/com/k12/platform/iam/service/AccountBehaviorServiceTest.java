package com.k12.platform.iam.service;

import com.k12.platform.common.security.K12Authorities;
import com.k12.platform.iam.config.IamBehaviorProperties;
import com.k12.platform.iam.dto.AccountBehaviorResponse;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.SysUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountBehaviorServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private OperationAuditService operationAuditService;

    private AccountBehaviorService service;

    @BeforeEach
    void setUp() {
        IamBehaviorProperties properties = new IamBehaviorProperties();
        properties.setOffTopicLimit(5);
        properties.setAbnormalBehaviorLimit(5);
        properties.setTempBanDuration(Duration.ofMinutes(2));
        service = new AccountBehaviorService(userMapper, operationAuditService, properties);
        authenticate(7L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void fifthOffTopicAddsAbnormalAndTempBans() {
        SysUser user = enabledUser(4, 0);
        when(userMapper.findSecurityUserForUpdate(7L)).thenReturn(user);

        AccountBehaviorResponse response = service.recordOffTopicStrike();

        assertThat(response.offTopicStrikeCount()).isZero();
        assertThat(response.abnormalBehaviorCount()).isEqualTo(1);
        assertThat(response.temporarilyLocked()).isTrue();
        assertThat(response.permanentlyBanned()).isFalse();
        assertThat(response.message()).contains("2 分钟");
        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        assertThat(user.getAuthVersion()).isEqualTo(2L);
        verify(operationAuditService).record(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void fifthAbnormalPermanentlyBans() {
        SysUser user = enabledUser(4, 4);
        when(userMapper.findSecurityUserForUpdate(7L)).thenReturn(user);

        AccountBehaviorResponse response = service.recordOffTopicStrike();

        assertThat(response.permanentlyBanned()).isTrue();
        assertThat(response.abnormalBehaviorCount()).isEqualTo(5);
        assertThat(user.getStatus()).isEqualTo(2);
        assertThat(response.message()).contains("永久封禁");
    }

    @Test
    void firstOffTopicOnlyWarns() {
        SysUser user = enabledUser(0, 0);
        when(userMapper.findSecurityUserForUpdate(7L)).thenReturn(user);

        AccountBehaviorResponse response = service.recordOffTopicStrike();

        assertThat(response.offTopicStrikeCount()).isEqualTo(1);
        assertThat(response.abnormalBehaviorCount()).isZero();
        assertThat(response.temporarilyLocked()).isFalse();
        assertThat(response.message()).contains("1/5");
        assertThat(response.message()).contains("**（无关提问 1/5）**");
        assertThat(response.message()).contains("临时封禁");
        assertThat(response.message()).contains("什么是提示词");
        assertThat(user.getLockedUntil()).isNull();
        verify(userMapper).updateById(user);
    }

    private SysUser enabledUser(int offTopic, int abnormal) {
        SysUser user = new SysUser();
        user.setId(7L);
        user.setStatus(1);
        user.setOffTopicStrikeCount(offTopic);
        user.setAbnormalBehaviorCount(abnormal);
        user.setAuthVersion(1L);
        user.setDeleted(0);
        return user;
    }

    private void authenticate(Long userId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("userId", userId.toString())
                .claim("authVersion", 1L)
                .subject("student")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                jwt, List.of(new SimpleGrantedAuthority(K12Authorities.ROLE_STUDENT))));
    }
}
