package com.k12.platform.agent.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Min;

/** Java 与 Python Worker 必须使用完全相同的交换机、队列和 routing key。 */
@Getter
@Setter
@Component
@Validated
@ConfigurationProperties(prefix = "k12.agent.rabbitmq")
public class AgentRabbitProperties {

    private boolean enabled;
    /** 等待 Broker 确认的上限，超时意味着投递结果不确定，不能自动重复执行。 */
    @Min(1)
    private long publishConfirmTimeoutMs = 5000;
    private String exchange = "k12.agent";
    private String requestQueue = "k12.agent.run.request";
    private String requestRoutingKey = "agent.run.request";
    private String resultQueue = "k12.agent.run.result";
    private String resultRoutingKey = "agent.run.result";
    /** 代码执行使用独立队列，避免与普通Agent消息模型互相污染。 */
    private String codeRequestQueue = "k12.code.execute.request";
    private String codeRequestRoutingKey = "code.execute.request";
    private String codeResultQueue = "k12.code.execute.result";
    private String codeResultRoutingKey = "code.execute.result";
    private String deadLetterExchange = "k12.agent.dlx";
    private String deadLetterQueue = "k12.agent.run.dead";
}
