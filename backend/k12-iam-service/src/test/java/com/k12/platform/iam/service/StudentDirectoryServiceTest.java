package com.k12.platform.iam.service;

import com.k12.platform.common.contract.iam.StudentValidationRequest;
import com.k12.platform.common.contract.iam.StudentValidationResponse;
import com.k12.platform.iam.mapper.UserMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/* 校验 IAM 对 Assessment 只暴露学生 ID，不暴露用户敏感资料。 */
@ExtendWith(MockitoExtension.class)
@DisplayName("学生账号批量校验")
class StudentDirectoryServiceTest {

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private StudentDirectoryService studentDirectoryService;

    @Test
    @DisplayName("重复 ID 应去重，并正确区分有效和无效学生")
    void shouldDeduplicateAndSplitStudentIds() {
        when(userMapper.findActiveStudentIds(List.of(2L, 3L, 4L))).thenReturn(List.of(2L, 4L));

        StudentValidationResponse response = studentDirectoryService.validateStudents(
                new StudentValidationRequest(List.of(2L, 3L, 2L, 4L))
        );

        assertThat(response.validStudentIds()).containsExactly(2L, 4L);
        assertThat(response.invalidUserIds()).containsExactly(3L);
        verify(userMapper).findActiveStudentIds(List.of(2L, 3L, 4L));
    }

    @Test
    @DisplayName("空账号列表必须拒绝")
    void shouldRejectEmptyUserIds() {
        assertThatThrownBy(() -> studentDirectoryService.validateStudents(
                new StudentValidationRequest(List.of())
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不能为空");
    }

    @Test
    @DisplayName("非正整数账号 ID 必须拒绝")
    void shouldRejectNonPositiveUserId() {
        assertThatThrownBy(() -> studentDirectoryService.validateStudents(
                new StudentValidationRequest(List.of(1L, 0L))
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("正整数");
    }
}
