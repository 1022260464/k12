package com.k12.platform.agent.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.util.StringUtils;

/** Python Runtime 只接受内部调用，配置密钥后由 Feign 自动添加请求头。 */
public class AgentRuntimeFeignConfiguration {

    @Bean
    public RequestInterceptor agentRuntimeApiKeyInterceptor(
            @Value("${k12.agent.runtime.api-key:}") String apiKey
    ) {
        return template -> {
            if (StringUtils.hasText(apiKey)) {
                template.header("X-Internal-Api-Key", apiKey);
            }
        };
    }
}
