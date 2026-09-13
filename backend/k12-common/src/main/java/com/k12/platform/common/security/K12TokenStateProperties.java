package com.k12.platform.common.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 业务服务调用 IAM 校验 JWT 登录状态时使用的配置。 */
@Getter
@Setter
@ConfigurationProperties(prefix = "k12.security.token-state")
public class K12TokenStateProperties {

    /** 默认关闭；需要远程校验的业务服务在 application.yml 中显式开启。 */
    private boolean remoteEnabled;

    /** IAM 使用服务内网地址，避免请求再次经过 Gateway 形成循环。 */
    private String endpoint = "http://127.0.0.1:8081/api/v1/iam/auth/token-state";

    private int connectTimeoutMillis = 1500;

    private int readTimeoutMillis = 2500;
}
