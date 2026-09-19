package com.k12.platform.iam.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** 教学助手无关提问 / 异常行为惩戒参数。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.iam.behavior")
public class IamBehaviorProperties {

    private int offTopicLimit = 5;
    private int abnormalBehaviorLimit = 5;
    /** 本地联调可设 2m；生产建议 2h。 */
    private Duration tempBanDuration = Duration.ofHours(2);
}
