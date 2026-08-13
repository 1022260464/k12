package com.k12.platform.common.security;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/*
 * 这里定义本系统自己的安全配置项。
 *
 * @ConfigurationProperties 会把 application.yml 里的 k12.security.* 配置
 * 自动绑定到这个类。当前仅维护匿名放行路径；
 * JWT 参数由 K12JwtProperties 单独管理。
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "k12.security")
public class K12SecurityProperties {

    /*
     * 不需要登录就能访问的接口。
     * 健康检查接口通常要放行，方便网关、注册中心、监控系统探活。
     */
    private List<String> permitPaths = new ArrayList<>(List.of(
            "/actuator/health",
            "/actuator/info",
            "/api/v1/gateway/health",
            "/api/v1/iam/health",
            "/api/v1/learning/health",
            "/api/v1/agents/health",
            "/api/v1/assessments/health"
    ));

}
