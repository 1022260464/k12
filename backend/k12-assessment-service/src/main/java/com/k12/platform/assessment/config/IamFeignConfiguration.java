package com.k12.platform.assessment.config;

import feign.RequestInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Configuration
public class IamFeignConfiguration {

    @Bean
    public RequestInterceptor bearerTokenRelayInterceptor() {
        return requestTemplate -> {
            if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
                HttpServletRequest request = attributes.getRequest();
                String authorization = request.getHeader("Authorization");
                if (authorization != null && !authorization.isBlank()) {
                    /* IAM 仍会独立校验 JWT，Assessment 不能伪造内部可信调用。 */
                    requestTemplate.header("Authorization", authorization);
                }
            }
        };
    }
}
