package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.knowledgegraph.KnowledgeGraphService;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.model.Course;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.ObjectProvider;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock
    private CourseMapper courseMapper;
    @Mock
    private CourseCoverStorage coverStorage;
    @Mock
    private KnowledgeGraphService knowledgeGraphService;
    @Mock
    private ObjectProvider<PublishedCourseListCache> publishedCourseListCache;
    @Mock
    private ObjectProvider<CourseMediaUrlCache> mediaUrlCache;

    @BeforeEach
    void authenticate() {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                Jwt.withTokenValue("test").header("alg", "none").subject("teacher").claim("userId", "42").build(), List.of()));
        when(publishedCourseListCache.getIfAvailable()).thenReturn(null);
        when(mediaUrlCache.getIfAvailable()).thenReturn(null);
    }

    @AfterEach
    void clearIdentity() { SecurityContextHolder.clearContext(); }

    private CourseService service(CourseMediaUrlResolver resolver) {
        return new CourseService(courseMapper, resolver, coverStorage, knowledgeGraphService,
                publishedCourseListCache, mediaUrlCache);
    }

    @Test
    @DisplayName("创建课程时清理文本并设置默认状态")
    void createCourseNormalizesFields() {
        CourseService service = service(objectKey -> null);
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
        assertThat(captor.getValue().getStatus()).isEqualTo(0);
        assertThat(captor.getValue().getTeacherId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("更新不存在的课程返回空结果")
    void updateMissingCourseReturnsEmpty() {
        CourseService service = service(objectKey -> null);
        when(courseMapper.selectForUpdate(99L)).thenReturn(null);

        Optional<CourseResponse> response = service.updateCourse(
                99L,
                new CourseRequest("一次函数", "数学", "八年级", null)
        );

        assertThat(response).isEmpty();
    }

    @Test
    @DisplayName("课程响应同时包含稳定对象键和临时访问地址")
    void responseContainsCourseCoverUrl() {
        CourseService service = service(objectKey -> "https://minio.example.test/signed/" + objectKey);
        Course course = new Course();
        course.setId(8L);
        course.setTitle("人工智能启蒙");
        course.setSubject("人工智能");
        course.setGradeLevel("小学高年级");
        course.setCoverObjectKey("course-assets/v1/k12-ai-learning-journey.png");
        course.setStatus(1);
        when(courseMapper.selectById(8L)).thenReturn(course);

        CourseResponse response = service.getCourse(8L).orElseThrow();

        assertThat(response.coverObjectKey()).isEqualTo("course-assets/v1/k12-ai-learning-journey.png");
        assertThat(response.coverUrl())
                .isEqualTo("https://minio.example.test/signed/course-assets/v1/k12-ai-learning-journey.png");
    }

    @Test
    @DisplayName("拒绝越过课程素材目录的对象键")
    void rejectsUnsafeCourseCoverObjectKey() {
        CourseService service = service(objectKey -> null);
        CourseRequest request = new CourseRequest(
                "人工智能启蒙",
                "人工智能",
                "小学高年级",
                null,
                "course-assets/../private/secret.png"
        );

        assertThatThrownBy(() -> service.createCourse(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("course-assets/");
    }
}
