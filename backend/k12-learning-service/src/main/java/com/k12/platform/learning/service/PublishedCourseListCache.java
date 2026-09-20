package com.k12.platform.learning.service;

import com.k12.platform.learning.dto.CourseResponse;

import java.util.List;
import java.util.Optional;

/** 已发布课程推荐列表缓存。 */
public interface PublishedCourseListCache {
    Optional<List<CourseResponse>> read();

    void replace(List<CourseResponse> courses);

    void invalidate();
}
