package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock
    private CourseMapper courseMapper;

    @BeforeEach
    void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                Jwt.withTokenValue("test").header("alg", "none").subject("teacher").claim("userId", "42").build(), List.of()));
    }

    @AfterEach
    void clearIdentity() { SecurityContextHolder.clearContext(); }

    @Test
    @DisplayName("创建课程时清理文本并设置默认状态")
    void createCourseNormalizesFields() {
        CourseService service = new CourseService(courseMapper);
        when(courseMapper.insert(any(Course.class))).thenAnswer(invocation -> {
            Course course = invocation.getArgument(0);
            course.setId(1L);
            return 1;
        });
        when(courseMapper.selectById(1L)).thenAnswer(invocation -> {
            Course course = new Course();
            course.setId(1L);
            course.setTitle("一次函数");
            course.setSubject("数学");
            course.setGradeLevel("八年级");
            return course;
        });

        service.createCourse(new CourseRequest("  一次函数  ", " 数学 ", " 八年级 ", "   "));

        ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
        verify(courseMapper).insert(captor.capture());
        assertThat(captor.getValue().getTitle()).isEqualTo("一次函数");
        assertThat(captor.getValue().getSubject()).isEqualTo("数学");
        assertThat(captor.getValue().getGradeLevel()).isEqualTo("八年级");
        assertThat(captor.getValue().getDescription()).isNull();
        assertThat(captor.getValue().getStatus()).isEqualTo(1);
        assertThat(captor.getValue().getTeacherId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("更新不存在的课程返回空结果")
    void updateMissingCourseReturnsEmpty() {
        CourseService service = new CourseService(courseMapper);
        when(courseMapper.selectForUpdate(99L)).thenReturn(null);

        Optional<CourseResponse> response = service.updateCourse(
                99L,
                new CourseRequest("一次函数", "数学", "八年级", null)
        );

        assertThat(response).isEmpty();
    }
}
