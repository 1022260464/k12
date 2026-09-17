package com.k12.platform.learning.service;

import org.springframework.util.StringUtils;

/** 将课程素材对象键解析为浏览器可短期访问的地址。 */
@FunctionalInterface
public interface CourseMediaUrlResolver {
    String COURSE_ASSET_PREFIX = "course-assets/";

    String resolve(String objectKey);

    static boolean isAllowedObjectKey(String objectKey) {
        return StringUtils.hasText(objectKey)
                && objectKey.startsWith(COURSE_ASSET_PREFIX)
                && !objectKey.startsWith("/")
                && !objectKey.contains("\\")
                && !objectKey.contains("../")
                && !objectKey.endsWith("/..");
    }
}
