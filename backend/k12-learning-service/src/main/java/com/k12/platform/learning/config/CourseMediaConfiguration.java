package com.k12.platform.learning.config;

import com.k12.platform.learning.service.CourseMediaUrlResolver;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.Http.Method;
import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * 课程封面访问配置。
 *
 * 签名URL在本地计算，不需要每次访问MinIO；异常时返回null，让前端使用默认插画。
 */
@Configuration(proxyBeanMethods = false)
public class CourseMediaConfiguration {
    private static final Logger log = LoggerFactory.getLogger(CourseMediaConfiguration.class);

    @Bean
    @ConditionalOnProperty(prefix = "k12.learning.media", name = "enabled", havingValue = "true")
    public CourseMediaUrlResolver minioCourseMediaUrlResolver(CourseMediaProperties properties) {
        if (!StringUtils.hasText(properties.getAccessKey()) || !StringUtils.hasText(properties.getSecretKey())) {
            throw new IllegalStateException("启用课程MinIO素材后必须配置访问密钥");
        }
        MinioClient client = MinioClient.builder()
                .endpoint(properties.getEndpoint())
                .credentials(properties.getAccessKey(), properties.getSecretKey())
                .build();
        int expirySeconds = Math.toIntExact(properties.getUrlTtl().toSeconds());

        return objectKey -> {
            if (!CourseMediaUrlResolver.isAllowedObjectKey(objectKey)) {
                return null;
            }
            try {
                return client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                        .method(Method.GET)
                        .bucket(properties.getBucket())
                        .object(objectKey)
                        .expiry(expirySeconds)
                        .build());
            } catch (Exception error) {
                log.warn("生成课程封面访问地址失败：objectKey={}", objectKey, error);
                return null;
            }
        };
    }

    @Bean
    @ConditionalOnMissingBean(CourseMediaUrlResolver.class)
    public CourseMediaUrlResolver disabledCourseMediaUrlResolver() {
        return objectKey -> null;
    }

}
