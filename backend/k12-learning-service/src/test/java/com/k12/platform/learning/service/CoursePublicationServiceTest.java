package com.k12.platform.learning.service;

import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.CourseMapper;
import com.k12.platform.learning.mapper.CourseSectionMapper;
import com.k12.platform.learning.model.Course;
import com.k12.platform.learning.model.CourseChapter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoursePublicationServiceTest {
    @Mock private CourseAccessService access;
    @Mock private CourseMapper courseMapper;
    @Mock private CourseChapterMapper chapterMapper;
    @Mock private CourseSectionMapper sectionMapper;

    @Test
    void rejectsChapterWithoutTeachingContent() {
        Course course = draft();
        CourseChapter chapter = chapter(null);
        when(access.requireCourse(1L, true)).thenReturn(course);
        when(chapterMapper.selectList(any())).thenReturn(List.of(chapter));
        when(sectionMapper.selectCount(any())).thenReturn(0L);

        assertThatThrownBy(() -> service().publish(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("没有导语或小节正文");
        verify(courseMapper, never()).updateById(any(Course.class));
    }

    @Test
    void publishesDraftWithSection() {
        Course course = draft();
        when(access.requireCourse(1L, true)).thenReturn(course);
        when(chapterMapper.selectList(any())).thenReturn(List.of(chapter(null)));
        when(sectionMapper.selectCount(any())).thenReturn(1L);

        service().publish(1L);

        verify(courseMapper).updateById(course);
        org.assertj.core.api.Assertions.assertThat(course.getStatus()).isEqualTo(1);
    }

    private CoursePublicationService service() {
        return new CoursePublicationService(access, courseMapper, chapterMapper, sectionMapper);
    }

    private Course draft() {
        Course course = new Course();
        course.setId(1L);
        course.setStatus(0);
        return course;
    }

    private CourseChapter chapter(String content) {
        CourseChapter chapter = new CourseChapter();
        chapter.setId(2L);
        chapter.setTitle("第一章");
        chapter.setContent(content);
        return chapter;
    }
}
