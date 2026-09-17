package com.k12.platform.agent.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

/** 排队与执行分别设置超时，不依赖 HTTP 请求触发清理。单位为秒。 */
@Getter
@Setter
@Validated
@Component
@ConfigurationProperties(prefix = "k12.agent.lifecycle")
public class AgentRunLifecycleProperties {
    @Min(1)
    private long queueTimeoutSeconds = 3600;
    @Min(1)
    private long executionTimeoutSeconds = 900;
    @Min(1)
    @Max(1000)
    private int batchSize = 100;
}
