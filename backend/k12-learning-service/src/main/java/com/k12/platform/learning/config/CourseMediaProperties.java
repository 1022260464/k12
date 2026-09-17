package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** 课程公开素材的MinIO读取配置；密钥只能通过环境变量或密钥管理系统注入。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.media")
public class CourseMediaProperties {
    private boolean enabled;
    private String endpoint = "http://127.0.0.1:9000";
    private String accessKey;
    private String secretKey;
    private String bucket = "k12-agent-artifacts";
    private Duration urlTtl = Duration.ofMinutes(15);
}
