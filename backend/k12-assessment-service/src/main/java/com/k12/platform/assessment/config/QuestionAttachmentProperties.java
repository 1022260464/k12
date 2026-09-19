package com.k12.platform.assessment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.assessment.attachments")
public class QuestionAttachmentProperties {
    private boolean enabled;
    private String endpoint;
    private String accessKey;
    private String secretKey;
    private String bucket;
    private Duration urlTtl = Duration.ofMinutes(15);
}
