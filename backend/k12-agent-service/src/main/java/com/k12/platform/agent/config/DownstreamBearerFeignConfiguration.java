package com.k12.platform.agent.config;

import feign.RequestInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 将当前请求的 Bearer Token 转发给 IAM、Assessment 等 Java 业务服务。
 *
 * <p>本类不加 {@code @Configuration}，只由指定的 FeignClient 使用，避免把用户 JWT
 * 误发给 Python Runtime 或其他不需要用户身份的下游服务。</p>
 */
public class DownstreamBearerFeignConfiguration {

    @Bean
    public RequestInterceptor downstreamBearerTokenRelayInterceptor() {
        return requestTemplate -> {
            if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
                return;
            }
            HttpServletRequest request = attributes.getRequest();
            String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
                // 下游服务仍会独立验签和校验权限，Agent Service 不会伪造用户身份。
                requestTemplate.header(HttpHeaders.AUTHORIZATION, authorization.trim());
            }
        };
    }
}
