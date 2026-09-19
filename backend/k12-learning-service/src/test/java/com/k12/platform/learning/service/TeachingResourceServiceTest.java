package com.k12.platform.learning.service;

import com.k12.platform.learning.mapper.TeachingResourceBindingMapper;
import com.k12.platform.learning.mapper.TeachingResourceEventMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.dto.TeachingResourceMetadata;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.model.TeachingResourceEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeachingResourceServiceTest {
    @Mock TeachingResourceMapper mapper;
    @Mock TeachingResourceEventMapper events;
    @Mock TeachingResourceBindingMapper bindings;
    @Mock TeachingResourceStorage storage;
    @Mock CourseMapper courses;
    @Mock CourseChapterMapper chapters;
    TeachingResourceService service;

    @BeforeEach
    void setup() {
        service = new TeachingResourceService(mapper, events, bindings, storage, courses, chapters);
        authenticate("ROLE_ADMIN", "42");
        org.mockito.Mockito.lenient().when(bindings.selectList(any())).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(bindings.delete(any())).thenReturn(1);
    }

    @AfterEach
    void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void publishingDoesNotIndexResource() {
        TeachingResource resource = resource("APPROVED", 5L);
        when(mapper.selectForUpdate(5L)).thenReturn(resource);

        var response = service.publish(5L);

        assertThat(response.status()).isEqualTo("PUBLISHED");
        assertThat(response.ragIndexStatus()).isEqualTo("NOT_INDEXED");
        ArgumentCaptor<TeachingResourceEvent> event = ArgumentCaptor.forClass(TeachingResourceEvent.class);
        verify(events).insert(event.capture());
        assertThat(event.getValue().getAction()).isEqualTo("PUBLISH");
        assertThat(event.getValue().getFromStatus()).isEqualTo("APPROVED");
    }

    @Test
    void draftCannotBePublished() {
        when(mapper.selectForUpdate(5L)).thenReturn(resource("DRAFT", 5L));
        assertThatThrownBy(() -> service.publish(5L)).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("只有审核通过");
        verify(mapper, never()).updateById(any(TeachingResource.class));
    }

    @Test
    void teacherCannotReadAnotherOwnersDraft() {
        authenticate("course:read", "99");
        when(mapper.selectById(5L)).thenReturn(resource("DRAFT", 5L));
        assertThatThrownBy(() -> service.get(5L)).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("只能访问自己");
    }

    @Test
    void publishedListFiltersServerSide() {
        service.published(1, 20);
        verify(mapper).search(null, "PUBLISHED", null, 21, 0L);
    }

    @Test
    void withdrawnResourceCanReturnToDraftWithoutIndexing() {
        when(mapper.selectForUpdate(5L)).thenReturn(resource("WITHDRAWN", 5L));
        var response = service.reopen(5L);
        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.ragIndexStatus()).isEqualTo("NOT_INDEXED");
    }

    @Test
    void uploadLinksPublishedCourseChapterAndKnowledgeCode() {
        Course course = course(42L);
        CourseChapter chapter = new CourseChapter();
        chapter.setCourseId(9L);
        chapter.setTitle("数据集划分");
        when(courses.selectById(9L)).thenReturn(course);
        when(chapters.selectById(12L)).thenReturn(chapter);
        when(storage.upload(any())).thenReturn(new TeachingResourceStorage.StoredFile(
                "teaching-resources/test.docx", "test.docx", "application/docx", 100L));
        when(mapper.insert(any(TeachingResource.class))).thenAnswer(invocation -> {
            TeachingResource resource = invocation.getArgument(0);
            resource.setId(88L);
            return 1;
        });
        when(bindings.selectList(any())).thenReturn(List.of());

        var response = service.upload(metadata(9L, 12L, "machine_learning.datasets"),
                new MockMultipartFile("file", "test.docx", "application/docx", new byte[]{'P', 'K', 3, 4}));

        assertThat(response.courseId()).isEqualTo(9L);
        assertThat(response.chapterId()).isEqualTo(12L);
        assertThat(response.chapterTitle()).isEqualTo("数据集划分");
        assertThat(response.grade()).isEqualTo("八年级");
        assertThat(response.textbook()).isEqualTo("AI 通识");
        assertThat(response.knowledgeCode()).isEqualTo("machine_learning.datasets");
    }

    @Test
    void chapterMustBelongToSelectedCourse() {
        when(courses.selectById(9L)).thenReturn(course(42L));
        CourseChapter chapter = new CourseChapter();
        chapter.setCourseId(10L);
        when(chapters.selectById(12L)).thenReturn(chapter);

        assertThatThrownBy(() -> service.upload(metadata(9L, 12L, null), null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("章节不属于");
        verify(storage, never()).upload(any());
    }

    @Test
    void teacherCannotLinkAnotherTeachersCourse() {
        authenticate("course:create", "99");
        when(courses.selectById(9L)).thenReturn(course(42L));

        assertThatThrownBy(() -> service.upload(metadata(9L, null, null), null))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("自己创建的课程");
        verify(storage, never()).upload(any());
    }

    @Test
    void invalidKnowledgeCodeIsRejectedBeforeStorage() {
        assertThatThrownBy(() -> service.upload(metadata(null, null, "BAD CODE"), null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("知识点编码");
        verify(storage, never()).upload(any());
    }

    private TeachingResourceMetadata metadata(Long courseId, Long chapterId, String knowledgeCode) {
        return new TeachingResourceMetadata("训练集", null, "JUNIOR_HIGH", "人工智能", "原创",
                courseId, chapterId, null, "AI 通识", knowledgeCode);
    }

    private Course course(Long teacherId) {
        Course course = new Course();
        course.setId(9L);
        course.setTeacherId(teacherId);
        course.setStatus(1);
        course.setSubject("人工智能");
        course.setGradeLevel("八年级");
        return course;
    }

    private TeachingResource resource(String status, long id) {
        TeachingResource resource = new TeachingResource();
        resource.setId(id);
        resource.setCreatedBy(42L);
        resource.setStatus(status);
        resource.setRagIndexStatus("NOT_INDEXED");
        return resource;
    }

    private void authenticate(String authority, String userId) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(
                Jwt.withTokenValue("test").header("alg", "none").subject("tester")
                        .claim("userId", userId).build(), List.of(new SimpleGrantedAuthority(authority))));
    }
}
