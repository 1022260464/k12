package com.k12.platform.learning.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CourseContentMediaRewriterTest {

    @Test
    @DisplayName("应从签名 URL 中提取 course-assets objectKey")
    void extractsObjectKeyFromPresignedUrl() {
        String src = "http://127.0.0.1:9000/k12-agent-artifacts/course-assets/content/12/6ab2a25230316f4180bf54b61e9d79a9.jpg"
                + "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900";
        assertThat(CourseContentMediaRewriter.extractObjectKey(src))
                .isEqualTo("course-assets/content/12/6ab2a25230316f4180bf54b61e9d79a9.jpg");
    }

    @Test
    @DisplayName("读取时应按 objectKey 刷新 img src，并保留 data-object-key")
    void refreshesSrcFromObjectKey() {
        CourseContentMediaRewriter rewriter = new CourseContentMediaRewriter(
                key -> "https://cdn.example/fresh/" + key);
        String html = "<p><img src=\"http://old/expired.jpg\" data-object-key=\"course-assets/content/1/a.jpg\" width=\"50%\"></p>";
        String refreshed = rewriter.refreshImageUrls(html);
        assertThat(refreshed).contains("src=\"https://cdn.example/fresh/course-assets/content/1/a.jpg\"");
        assertThat(refreshed).contains("data-object-key=\"course-assets/content/1/a.jpg\"");
    }

    @Test
    @DisplayName("保存时应把 URL 里的 objectKey 盖章到 data-object-key")
    void stampsObjectKeyOnSave() {
        CourseContentMediaRewriter rewriter = new CourseContentMediaRewriter(key -> null);
        String html = "<img src=\"http://127.0.0.1:9000/bucket/course-assets/content/3/abc.png?X-Amz-Expires=1\" alt=\"x\">";
        String stamped = rewriter.stampObjectKeys(html);
        assertThat(stamped).contains("data-object-key=\"course-assets/content/3/abc.png\"");
    }
}
