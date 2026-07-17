package com.k12.platform.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/*
 * 这里定义本系统自己的安全配置项。
 *
 * @ConfigurationProperties 会把 application.yml 里的 k12.security.* 配置
 * 自动绑定到这个类。例如：
 *
 * k12:
 *   security:
 *     user:
 *       name: admin
 *       password: admin123
 */
@ConfigurationProperties(prefix = "k12.security")
public class K12SecurityProperties {

    /*
     * 默认登录用户配置。
     * 当前阶段先使用内存用户，后续接入数据库/JWT 后可以替换掉。
     */
    private User user = new User();

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

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public List<String> getPermitPaths() {
        return permitPaths;
    }

    public void setPermitPaths(List<String> permitPaths) {
        this.permitPaths = permitPaths;
    }

    public static class User {

        /*
         * 默认用户名。
         * 可以通过 k12.security.user.name 覆盖。
         */
        private String name = "admin";

        /*
         * 默认密码。
         * 开发环境可以先这样用，生产环境必须改成更安全的配置方式。
         */
        private String password = "admin123";

        /*
         * 用户角色。
         * Spring Security 内部会把 ADMIN 识别为 ROLE_ADMIN。
         */
        private List<String> roles = new ArrayList<>(List.of("ADMIN"));

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public List<String> getRoles() {
            return roles;
        }

        public void setRoles(List<String> roles) {
            this.roles = roles;
        }
    }
}
