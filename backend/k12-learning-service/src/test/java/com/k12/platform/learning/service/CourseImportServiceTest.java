package com.k12.platform.learning.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k12.platform.learning.dto.ChapterRequest;
import com.k12.platform.learning.dto.CourseRequest;
import com.k12.platform.learning.dto.CourseResponse;
import com.k12.platform.learning.dto.SectionRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("课程 JSON 批量导入")
class CourseImportServiceTest {

    @Mock CourseService courses;
    @Mock CourseChapterService chapters;
    @Mock CourseSectionService sections;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private CourseImportService service() {
        return new CourseImportService(objectMapper, validator, courses, chapters, sections);
    }

    @Test
    @DisplayName("合法模板应创建课程、章节和小节")
    void shouldImportCourseChapterAndSection() {
        when(courses.createCourse(any(CourseRequest.class)))
                .thenReturn(course(11L));
        when(chapters.create(eq(11L), any(ChapterRequest.class)))
                .thenReturn(new com.k12.platform.learning.dto.ChapterResponse(21L, 11L, "认识人工智能", "导言", 1, Instant.now()));
        when(sections.create(eq(11L), eq(21L), any(SectionRequest.class)))
                .thenReturn(new com.k12.platform.learning.dto.SectionResponse(31L, 21L, "人工智能是什么", "正文", 1, Instant.now()));

        var file = jsonFile("""
                {
                  "version": 1,
                  "courses": [{
                    "title": "人工智能入门",
                    "subject": "人工智能",
                    "gradeLevel": "初中",
                    "description": "课程简介",
                    "chapters": [{
                      "title": "认识人工智能",
                      "content": "导言",
                      "sortOrder": 1,
                      "sections": [{ "title": "人工智能是什么", "content": "正文", "sortOrder": 1 }]
                    }]
                  }]
                }
                """);

        assertThat(service().importBatch(file)).extracting(CourseResponse::id).containsExactly(11L);
        verify(courses).createCourse(any(CourseRequest.class));
        verify(chapters).create(eq(11L), any(ChapterRequest.class));
        verify(sections).create(eq(11L), eq(21L), any(SectionRequest.class));
    }

    @Test
    @DisplayName("非 JSON 或超限文件必须拒绝")
    void shouldRejectInvalidFile() {
        var txt = new MockMultipartFile("file", "courses.txt", "text/plain", "{}".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> service().importBatch(txt))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JSON");
    }

    @Test
    @DisplayName("version 不正确时应在创建前失败")
    void shouldRejectWrongVersionBeforeCreate() {
        var file = jsonFile("""
                { "version": 2, "courses": [{
                  "title": "课", "subject": "人工智能", "gradeLevel": "初中",
                  "chapters": [{ "title": "章", "sortOrder": 1, "sections": [{ "title": "节", "content": "正文", "sortOrder": 1 }] }]
                }] }
                """);
        assertThatThrownBy(() -> service().importBatch(file))
                .isInstanceOf(IllegalArgumentException.class);
        verify(courses, never()).createCourse(any());
    }

    @Test
    @DisplayName("小节总数超过 500 必须拒绝")
    void shouldRejectTooManySections() {
        StringBuilder chaptersJson = new StringBuilder();
        for (int chapter = 0; chapter < 6; chapter++) {
            if (chapter > 0) chaptersJson.append(',');
            chaptersJson.append("{\"title\":\"章").append(chapter).append("\",\"sortOrder\":")
                    .append(chapter).append(",\"sections\":[");
            for (int section = 0; section < 84; section++) {
                if (section > 0) chaptersJson.append(',');
                chaptersJson.append("{\"title\":\"s").append(section)
                        .append("\",\"content\":\"c\",\"sortOrder\":").append(section).append('}');
            }
            chaptersJson.append("]}");
        }
        var file = jsonFile("""
                { "version": 1, "courses": [{
                  "title": "课", "subject": "人工智能", "gradeLevel": "初中",
                  "chapters": [%s]
                }] }
                """.formatted(chaptersJson));
        assertThatThrownBy(() -> service().importBatch(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("500");
        verify(courses, never()).createCourse(any());
    }

    private static MockMultipartFile jsonFile(String content) {
        return new MockMultipartFile("file", "course-import.json", "application/json",
                content.getBytes(StandardCharsets.UTF_8));
    }

    private static CourseResponse course(long id) {
        return new CourseResponse(id, "人工智能入门", "人工智能", "初中", "课程简介",
                null, null, Instant.now(), 9L, 0);
    }
}
