package com.k12.platform.agent.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

/** 代码沙箱按用户计费的日配额；建表前保持关闭。 */
@Component
@Validated
@ConfigurationProperties(prefix = "k12.agent.code-quota")
public class CodeExecutionQuotaProperties {

    private boolean enabled;

    @Min(1)
    @Max(50)
    private int dailyLimit = 5;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getDailyLimit() {
        return dailyLimit;
    }

    public void setDailyLimit(int dailyLimit) {
        this.dailyLimit = dailyLimit;
    }
}
