package com.k12.platform.learning.web;

import com.k12.platform.common.api.ApiResponse;
import com.k12.platform.learning.dto.TeachingResourceResponse;
import com.k12.platform.learning.mapper.CourseChapterMapper;
import com.k12.platform.learning.mapper.TeachingResourceBindingMapper;
import com.k12.platform.learning.mapper.TeachingResourceMapper;
import com.k12.platform.learning.model.CourseChapter;
import com.k12.platform.learning.model.TeachingResource;
import com.k12.platform.learning.service.CourseAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/learning/courses/{courseId}")
public class CourseAttachmentController {
    private final CourseAccessService access;
    private final CourseChapterMapper chapters;
    private final TeachingResourceMapper resources;
    private final TeachingResourceBindingMapper bindings;

    public CourseAttachmentController(CourseAccessService access, CourseChapterMapper chapters,
                                      TeachingResourceMapper resources, TeachingResourceBindingMapper bindings) {
        this.access = access;
        this.chapters = chapters;
        this.resources = resources;
        this.bindings = bindings;
    }

    @GetMapping("/attachments")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public ApiResponse<List<TeachingResourceResponse>> courseAttachments(@PathVariable Long courseId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        return ApiResponse.ok(list(courseId, null));
    }

    @GetMapping("/chapters/{chapterId}/attachments")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('course:read')")
    public ApiResponse<List<TeachingResourceResponse>> chapterAttachments(@PathVariable Long courseId,
                                                                            @PathVariable Long chapterId) {
        access.requireContentAccess(access.requireCourse(courseId, false));
        CourseChapter chapter = chapters.selectById(chapterId);
        if (chapter == null || !courseId.equals(chapter.getCourseId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "章节不存在");
        }
        return ApiResponse.ok(list(courseId, chapterId));
    }

    private List<TeachingResourceResponse> list(Long courseId, Long chapterId) {
        List<Long> ids;
        try {
            ids = bindings.findPublishedResourceIds(courseId, chapterId);
        } catch (RuntimeException exception) {
            // 绑定表查询异常时回退旧字段，避免附件接口整页 500。
            ids = List.of();
        }
        if (ids == null || ids.isEmpty()) {
            // 兼容尚未回填绑定表的旧数据
            var query = com.baomidou.mybatisplus.core.toolkit.Wrappers.lambdaQuery(TeachingResource.class)
                    .eq(TeachingResource::getCourseId, courseId)
                    .eq(TeachingResource::getStatus, "PUBLISHED");
            if (chapterId == null) query.isNull(TeachingResource::getChapterId);
            else query.eq(TeachingResource::getChapterId, chapterId);
            return resources.selectList(query.orderByDesc(TeachingResource::getPublishedTime).last("LIMIT 100"))
                    .stream().map(TeachingResourceResponse::from).toList();
        }
        return ids.stream().map(resources::selectById).filter(Objects::nonNull)
                .map(TeachingResourceResponse::from).toList();
    }
}
