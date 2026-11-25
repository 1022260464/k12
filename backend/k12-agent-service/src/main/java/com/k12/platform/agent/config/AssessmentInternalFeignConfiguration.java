package com.k12.platform.agent.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.util.StringUtils;

/**
 * 教学 Agent 向 Assessment 写回学习证据时的服务间鉴权。
 *
 * <p>与 {@link DownstreamBearerFeignConfiguration} 不同：证据写回代表服务本身的
 * 可信判断，不能复用学生 Token（否则学生拿到自己的 Token 也能伪造证据），
 * 因此改用两侧共享的内部密钥。</p>
 */
public class AssessmentInternalFeignConfiguration {

    @Bean
    public RequestInterceptor assessmentInternalTokenInterceptor(
            @Value("${k12.clients.assessment-internal-token:}") String internalToken) {
        return requestTemplate -> {
            if (StringUtils.hasText(internalToken)) {
                requestTemplate.header("X-K12-Internal-Token", internalToken.trim());
            }
        };
    }
}
