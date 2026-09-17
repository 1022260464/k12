package com.k12.platform.agent.messaging;

import com.k12.platform.agent.config.AgentRabbitProperties;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/** 发布持久化任务消息；correlationId 使用 runId，便于日志和消息追踪。 */
@Component
public class AgentRunTaskPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final AgentRabbitProperties properties;

    public AgentRunTaskPublisher(RabbitTemplate rabbitTemplate, AgentRabbitProperties properties) {
        this.rabbitTemplate = rabbitTemplate;
        this.properties = properties;
    }

    public void publish(AgentRunTaskMessage task) {
        CorrelationData correlation = new CorrelationData(task.runId());
        rabbitTemplate.convertAndSend(
                properties.getExchange(),
                properties.getRequestRoutingKey(),
                task,
                message -> {
                    message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    message.getMessageProperties().setContentType("application/json");
                    message.getMessageProperties().setCorrelationId(task.runId());
                    return message;
                },
                correlation
        );
        try {
            // mandatory + returns 识别“交换机存在但没有匹配队列”，confirm 识别 Broker 拒收。
            CorrelationData.Confirm confirm = correlation.getFuture()
                    .get(properties.getPublishConfirmTimeoutMs(), TimeUnit.MILLISECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) {
                throw new AmqpException("Agent 任务未被队列接收");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AgentPublishUnconfirmedException("等待 Agent 消息确认被中断", exception);
        } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException exception) {
            throw new AgentPublishUnconfirmedException("Agent 消息投递结果未确认", exception);
        }
    }
}
