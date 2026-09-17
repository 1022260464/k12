package com.k12.platform.agent.messaging;

import com.k12.platform.agent.config.AgentRabbitProperties;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/** 可靠发布异步代码任务，确认策略与普通Agent任务保持一致。 */
@Component
public class CodeExecutionTaskPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final AgentRabbitProperties properties;

    public CodeExecutionTaskPublisher(RabbitTemplate rabbitTemplate, AgentRabbitProperties properties) {
        this.rabbitTemplate = rabbitTemplate;
        this.properties = properties;
    }

    public void publish(CodeExecutionTaskMessage task) {
        CorrelationData correlation = new CorrelationData(task.runId());
        rabbitTemplate.convertAndSend(
                properties.getExchange(),
                properties.getCodeRequestRoutingKey(),
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
            CorrelationData.Confirm confirm = correlation.getFuture()
                    .get(properties.getPublishConfirmTimeoutMs(), TimeUnit.MILLISECONDS);
            if (!confirm.isAck() || correlation.getReturned() != null) {
                throw new AmqpException("代码执行任务未被队列接收");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AgentPublishUnconfirmedException("等待代码执行消息确认被中断", exception);
        } catch (java.util.concurrent.ExecutionException | java.util.concurrent.TimeoutException exception) {
            throw new AgentPublishUnconfirmedException("代码执行消息投递结果未确认", exception);
        }
    }
}
