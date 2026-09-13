package com.k12.platform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.iam.dto.LearningProfileRequest;
import com.k12.platform.iam.dto.LearningProfileResponse;
import com.k12.platform.iam.mapper.LearningProfileMapper;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.LearningProfile;
import com.k12.platform.iam.model.SysUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * 学习档案 Service 单元测试。
 * Mapper 使用 Mockito 替身，不连接真实 MySQL，专门验证档案规范化和业务校验。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("学习档案业务")
class LearningProfileServiceTest {

    @Mock
    private LearningProfileMapper learningProfileMapper;

    @Mock
    private UserMapper userMapper;

    private LearningProfileService learningProfileService;

    @BeforeEach
    void setUp() {
        learningProfileService = new LearningProfileService(
                learningProfileMapper,
                userMapper,
                new ObjectMapper()
        );
        authenticate(7L, "student07", "learning-profile:update");
    }

    @AfterEach
    void clearSecurityContext() {
        /* SecurityContextHolder 使用线程变量，测试结束必须清理，避免影响下一条用例。 */
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("保存档案时应规范化文本、兴趣去重并返回数据库结果")
    void shouldSaveNormalizedProfile() {
        SysUser activeUser = new SysUser();
        activeUser.setId(7L);
        activeUser.setStatus(1);
        when(userMapper.selectById(7L)).thenReturn(activeUser);

        AtomicReference<LearningProfile> savedProfile = new AtomicReference<>();
        when(learningProfileMapper.upsert(any(LearningProfile.class))).thenAnswer(invocation -> {
            LearningProfile profile = invocation.getArgument(0);
            profile.setUpdatedTime(Instant.parse("2026-09-13T10:00:00Z"));
            savedProfile.set(profile);
            return 1;
        });
        when(learningProfileMapper.selectById(7L)).thenAnswer(invocation -> savedProfile.get());

        LearningProfileResponse response = learningProfileService.saveCurrentProfile(
                new LearningProfileRequest(
                        " junior_high ",
                        7,
                        "  人教版  ",
                        List.of("编程", "编程", "机器人")
                )
        );

        assertThat(response.userId()).isEqualTo(7L);
        assertThat(response.schoolStage()).isEqualTo("JUNIOR_HIGH");
        assertThat(response.textbook()).isEqualTo("人教版");
        assertThat(response.interests()).containsExactly("编程", "机器人");
        assertThat(savedProfile.get().getInterestsJson()).isEqualTo("[\"编程\",\"机器人\"]");
    }

    @Test
    @DisplayName("学段和年级不匹配时不得写入数据库")
    void shouldRejectMismatchedStageAndGrade() {
        SysUser activeUser = new SysUser();
        activeUser.setStatus(1);
        when(userMapper.selectById(7L)).thenReturn(activeUser);

        LearningProfileRequest request = new LearningProfileRequest(
                "PRIMARY_LOWER",
                8,
                null,
                List.of()
        );

        assertThatThrownBy(() -> learningProfileService.saveCurrentProfile(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("grade 与 schoolStage 不匹配");
        verify(learningProfileMapper, never()).upsert(any());
    }

    @Test
    @DisplayName("尚未创建学习档案时返回 404")
    void shouldReturnNotFoundWhenProfileDoesNotExist() {
        SysUser activeUser = new SysUser();
        activeUser.setStatus(1);
        when(userMapper.selectById(7L)).thenReturn(activeUser);
        when(learningProfileMapper.selectById(7L)).thenReturn(null);

        assertThatThrownBy(() -> learningProfileService.getCurrentProfile())
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("停用用户不能读取学习档案")
    void shouldRejectDisabledUser() {
        SysUser disabledUser = new SysUser();
        disabledUser.setStatus(0);
        when(userMapper.selectById(7L)).thenReturn(disabledUser);

        assertThatThrownBy(() -> learningProfileService.getCurrentProfile())
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(learningProfileMapper, never()).selectById(any());
    }

    private void authenticate(Long userId, String username, String... authorities) {
        List<SimpleGrantedAuthority> grantedAuthorities = List.of(authorities).stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject(username)
                .claim("userId", userId.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, grantedAuthorities, username)
        );
    }
}
