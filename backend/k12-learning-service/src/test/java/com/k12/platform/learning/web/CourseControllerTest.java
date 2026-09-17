package com.k12.platform.learning.web;

import com.k12.platform.common.security.K12MethodSecurityExceptionHandler;
import com.k12.platform.learning.dto.ChapterProgressResponse;
import com.k12.platform.learning.service.CourseChapterService;
import com.k12.platform.learning.service.CourseStudyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 只测 HTTP 绑定、请求体校验和错误包装；真正的 Service 权限代理由集成测试覆盖。 */
class CourseControllerTest {
    private CourseChapterService chapters;
    private CourseStudyService study;
    private MockMvc mvc;
    private static final String BASE = "/api/v1/learning/courses/1";

    @BeforeEach
    void setUp() {
        chapters = mock(CourseChapterService.class);
        study = mock(CourseStudyService.class);
        mvc = MockMvcBuilders.standaloneSetup(new CourseChapterController(chapters), new CourseStudyController(study))
                .setControllerAdvice(new LearningExceptionHandler(), new K12MethodSecurityExceptionHandler()).build();
    }

    @Test
    @DisplayName("缺失或超范围进度返回统一 400，不能执行 Service 写操作")
    void invalidProgressRejected() throws Exception {
        for (String body : new String[]{"{}", "{\"progressPercent\":-1}", "{\"progressPercent\":101}"}) {
            mvc.perform(put(BASE + "/chapters/2/progress").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        }
        verifyNoInteractions(study);
    }

    @Test
    @DisplayName("章节空白标题、缺正文或负排序值被 HTTP 校验拒绝")
    void invalidChapterRejected() throws Exception {
        for (String body : new String[]{
                "{\"title\":\" \",\"content\":\"正文\",\"sortOrder\":1}",
                "{\"title\":\"第一章\",\"sortOrder\":1}",
                "{\"title\":\"第一章\",\"content\":\"正文\",\"sortOrder\":-1}"}) {
            mvc.perform(post(BASE + "/chapters").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        }
        verifyNoInteractions(chapters);
    }

    @Test
    @DisplayName("非法 JSON 与非数字课程编号均返回统一 400")
    void invalidJsonAndIdRejected() throws Exception {
        mvc.perform(put(BASE + "/chapters/2/progress").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        mvc.perform(get("/api/v1/learning/courses/abc/enrollment"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(400));
        verifyNoInteractions(study);
    }

    @Test
    @DisplayName("数据权限不足和资源不存在保持实际 HTTP 状态，不伪装成 200")
    void businessStatusIsPreserved() throws Exception {
        when(study.enroll(1L)).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "课程不存在"));
        mvc.perform(put(BASE + "/enrollment"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value(404));
        when(chapters.list(1L)).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "请先选课"));
        mvc.perform(get(BASE + "/chapters"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("请先选课"));
    }

    @Test
    @DisplayName("方法权限异常由公共安全处理器统一返回 403")
    void methodSecurityErrorIsWrapped() throws Exception {
        when(study.enroll(1L)).thenThrow(new AccessDeniedException("denied"));
        mvc.perform(put(BASE + "/enrollment"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("进度路由显式绑定课程和章节编号，并返回统一响应")
    void progressRouteBindsIds() throws Exception {
        when(study.updateProgress(1L, 2L, 60)).thenReturn(new ChapterProgressResponse(2L, "第一章", 60, null));
        mvc.perform(put(BASE + "/chapters/2/progress").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"progressPercent\":60}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.chapterId").value(2)).andExpect(jsonPath("$.data.progressPercent").value(60));
        verify(study).updateProgress(1L, 2L, 60);
    }
}
