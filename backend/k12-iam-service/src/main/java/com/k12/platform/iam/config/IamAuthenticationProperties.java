package com.k12.platform.iam.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** IAM 登录风控参数，可由 application.yml 或环境变量覆盖。 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "k12.iam.authentication")
public class IamAuthenticationProperties {

    private int maxFailedAttempts = 5;
    private Duration lockDuration = Duration.ofMinutes(15);
}
