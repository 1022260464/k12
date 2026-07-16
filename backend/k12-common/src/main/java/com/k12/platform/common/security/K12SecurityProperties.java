package com.k12.platform.common.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "k12.security")
public class K12SecurityProperties {

    private User user = new User();

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

        private String name = "admin";

        private String password = "admin123";

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
