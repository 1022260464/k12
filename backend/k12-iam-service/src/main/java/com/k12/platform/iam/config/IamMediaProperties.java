package com.k12.platform.iam.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;

/** 用户头像 MinIO 配置，可与课程媒体共用同一套环境变量。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.iam.media")
public class IamMediaProperties {
    private boolean enabled;
    private String endpoint = "http://127.0.0.1:9000";
    private String publicEndpoint;
    private String accessKey;
    private String secretKey;
    private String bucket = "k12-user-avatars";
    private Duration urlTtl = Duration.ofMinutes(60);

    public String resolvePublicEndpoint() {
        return StringUtils.hasText(publicEndpoint) ? publicEndpoint : endpoint;
    }
}
