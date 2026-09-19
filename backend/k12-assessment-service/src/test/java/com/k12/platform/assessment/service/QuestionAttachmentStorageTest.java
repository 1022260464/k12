package com.k12.platform.assessment.service;

import com.k12.platform.assessment.config.QuestionAttachmentProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("题目附件存储校验")
class QuestionAttachmentStorageTest {

    private final QuestionAttachmentStorage storage = new QuestionAttachmentStorage(new QuestionAttachmentProperties());

    @Test
    @DisplayName("内容与扩展名不匹配时拒绝")
    void rejectsMismatchedContent() {
        var file = new MockMultipartFile("file", "stem.pdf", "application/pdf", "not a PDF".getBytes());
        assertThatThrownBy(() -> storage.upload(file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("扩展名不匹配");
    }

    @Test
    @DisplayName("合法文件在未启用存储时返回 503")
    void requiresEnabledStorage() {
        var file = new MockMultipartFile("file", "stem.pdf", "application/pdf", "%PDF-1.7".getBytes());
        assertThatThrownBy(() -> storage.upload(file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("题目附件存储未启用");
    }

    @Test
    @DisplayName("空文件或不支持类型必须拒绝")
    void rejectsEmptyOrUnsupportedType() {
        var empty = new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[0]);
        assertThatThrownBy(() -> storage.upload(empty))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("10 MB");

        var exe = new MockMultipartFile("file", "a.exe", "application/octet-stream", new byte[]{1, 2, 3});
        assertThatThrownBy(() -> storage.upload(exe))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("仅支持");
    }
}
