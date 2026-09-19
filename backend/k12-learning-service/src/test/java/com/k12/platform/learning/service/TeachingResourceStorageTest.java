package com.k12.platform.learning.service;

import com.k12.platform.learning.config.CourseMediaProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TeachingResourceStorageTest {
    private final TeachingResourceStorage storage = new TeachingResourceStorage(new CourseMediaProperties());

    @Test
    void rejectsFileWhoseContentDoesNotMatchExtension() {
        var file = new MockMultipartFile("file", "lesson.pdf", "application/pdf", "not a PDF".getBytes());
        assertThatThrownBy(() -> storage.upload(file)).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("扩展名不匹配");
    }

    @Test
    void validFileRequiresEnabledStorage() {
        var file = new MockMultipartFile("file", "lesson.pdf", "application/pdf", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> storage.upload(file)).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("资料存储未启用");
    }
}
