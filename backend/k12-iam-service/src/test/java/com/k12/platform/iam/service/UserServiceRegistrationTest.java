package com.k12.platform.iam.service;

import com.k12.platform.iam.dto.RegisterRequest;
import com.k12.platform.iam.mapper.UserMapper;
import com.k12.platform.iam.model.SysUser;
import com.k12.platform.iam.model.UserAccount;
import com.k12.platform.common.security.K12Authorities;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceRegistrationTest {

    @Test
    void publicRegistrationNormalizesOptionalFieldsAndForcesStudentRole() {
        UserMapper userMapper = mock(UserMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        OperationAuditService auditService = mock(OperationAuditService.class);
        UserAvatarStorage avatarStorage = mock(UserAvatarStorage.class);
        UserService userService = new UserService(userMapper, passwordEncoder, auditService, avatarStorage);

        when(passwordEncoder.encode("student123")).thenReturn("bcrypt-hash");
        when(userMapper.countByUsername("student01", null)).thenReturn(0);
        when(userMapper.insert(any(SysUser.class))).thenAnswer(invocation -> {
            SysUser user = invocation.getArgument(0);
            user.setId(10L);
            return 1;
        });
        when(userMapper.assignRoleByCode(10L, K12Authorities.ROLE_STUDENT)).thenReturn(1);
        UserAccount account = new UserAccount();
        account.setId(10L);
        account.setUsername("student01");
        account.setNickname("O'Connor");
        account.setRoleCode(K12Authorities.ROLE_STUDENT);
        account.setStatus("1");
        when(userMapper.findAccountById(10L)).thenReturn(account);

        userService.registerStudent(new RegisterRequest(
                "student01",
                "student123",
                "  O'Connor  ",
                "   "
        ));

        ArgumentCaptor<SysUser> userCaptor = ArgumentCaptor.forClass(SysUser.class);
        verify(userMapper).insert(userCaptor.capture());
        assertEquals("student01", userCaptor.getValue().getUsername());
        assertEquals("O'Connor", userCaptor.getValue().getNickname());
        assertNull(userCaptor.getValue().getEmail());
        assertEquals("bcrypt-hash", userCaptor.getValue().getPasswordHash());
        verify(userMapper).assignRoleByCode(10L, K12Authorities.ROLE_STUDENT);
    }

    @Test
    void publicRegistrationRejectsDuplicateUsername() {
        UserMapper userMapper = mock(UserMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        OperationAuditService auditService = mock(OperationAuditService.class);
        UserAvatarStorage avatarStorage = mock(UserAvatarStorage.class);
        UserService userService = new UserService(userMapper, passwordEncoder, auditService, avatarStorage);

        when(userMapper.countByUsername("student01", null)).thenReturn(1);

        IllegalArgumentException error = org.junit.jupiter.api.Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> userService.registerStudent(new RegisterRequest(
                        "student01",
                        "student123",
                        "小明",
                        null
                ))
        );
        assertEquals("用户名已存在", error.getMessage());
    }

    @Test
    void publicRegistrationRejectsDuplicateEmail() {
        UserMapper userMapper = mock(UserMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        OperationAuditService auditService = mock(OperationAuditService.class);
        UserAvatarStorage avatarStorage = mock(UserAvatarStorage.class);
        UserService userService = new UserService(userMapper, passwordEncoder, auditService, avatarStorage);

        when(userMapper.countByUsername("student02", null)).thenReturn(0);
        when(userMapper.countByEmail("dup@example.com", null)).thenReturn(1);

        IllegalArgumentException error = org.junit.jupiter.api.Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> userService.registerStudent(new RegisterRequest(
                        "student02",
                        "student123",
                        "小明",
                        "dup@example.com"
                ))
        );
        assertEquals("邮箱已被使用", error.getMessage());
    }

    @Test
    void publicRegistrationRejectsDuplicateUsernameAndEmailTogether() {
        UserMapper userMapper = mock(UserMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        OperationAuditService auditService = mock(OperationAuditService.class);
        UserAvatarStorage avatarStorage = mock(UserAvatarStorage.class);
        UserService userService = new UserService(userMapper, passwordEncoder, auditService, avatarStorage);

        when(userMapper.countByUsername("student01", null)).thenReturn(1);
        when(userMapper.countByEmail("dup@example.com", null)).thenReturn(1);

        IllegalArgumentException error = org.junit.jupiter.api.Assertions.assertThrows(
                IllegalArgumentException.class,
                () -> userService.registerStudent(new RegisterRequest(
                        "student01",
                        "student123",
                        "小明",
                        "dup@example.com"
                ))
        );
        assertEquals("用户名已存在；邮箱已被使用", error.getMessage());
    }
}
