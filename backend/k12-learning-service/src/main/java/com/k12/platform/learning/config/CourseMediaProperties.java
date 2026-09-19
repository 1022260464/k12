package com.k12.platform.learning.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;

/** 课程公开素材的MinIO读取配置；密钥只能通过环境变量或密钥管理系统注入。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.learning.media")
public class CourseMediaProperties {
    private boolean enabled;
    /** 服务端读写 MinIO 的地址（可为内网）。 */
    private String endpoint = "http://127.0.0.1:9000";
    /**
     * 浏览器访问签名 URL 使用的地址。未配置时回退到 endpoint。
     * 当 endpoint 是内网 IP、而本地浏览器经代理无法直连时，应配置公网可达地址。
     */
    private String publicEndpoint;
    private String accessKey;
    private String secretKey;
    private String bucket = "k12-agent-artifacts";
    private Duration urlTtl = Duration.ofMinutes(15);

    public String resolvePublicEndpoint() {
        return StringUtils.hasText(publicEndpoint) ? publicEndpoint : endpoint;
    }
}
