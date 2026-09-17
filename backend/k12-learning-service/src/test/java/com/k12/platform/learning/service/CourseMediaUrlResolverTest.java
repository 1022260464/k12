package com.k12.platform.learning.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CourseMediaUrlResolverTest {

    @Test
    @DisplayName("只允许课程素材目录中的稳定对象键")
    void validatesCourseAssetObjectKeys() {
        assertThat(CourseMediaUrlResolver.isAllowedObjectKey(
                "course-assets/v1/k12-ai-learning-journey.png"
        )).isTrue();
        assertThat(CourseMediaUrlResolver.isAllowedObjectKey("private/answer.txt")).isFalse();
        assertThat(CourseMediaUrlResolver.isAllowedObjectKey("course-assets/../private/answer.txt")).isFalse();
        assertThat(CourseMediaUrlResolver.isAllowedObjectKey("course-assets\\answer.txt")).isFalse();
        assertThat(CourseMediaUrlResolver.isAllowedObjectKey(null)).isFalse();
    }
}
