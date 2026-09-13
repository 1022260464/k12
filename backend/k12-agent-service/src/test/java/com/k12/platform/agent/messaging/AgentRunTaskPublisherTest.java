package com.k12.platform.agent.messaging;

import com.k12.platform.agent.config.AgentRabbitProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.ReturnedMessage;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgentRunTaskPublisherTest {
    private final RabbitTemplate template = mock(RabbitTemplate.class);
    private final AgentRabbitProperties properties = new AgentRabbitProperties();
    private final AgentRunTaskMessage task = new AgentRunTaskMessage("run-1", "demo-chart", "test", "42", Map.of());

    private void brokerResponds(Consumer<CorrelationData> response) {
        doAnswer(invocation -> {
            response.accept(invocation.getArgument(4));
            return null;
        }).when(template).convertAndSend(anyString(), anyString(), any(Object.class),
                any(MessagePostProcessor.class), any(CorrelationData.class));
    }

    @Test
    @DisplayName("Broker 确认且没有退回消息时发布成功")
    void acceptsAck() {
        brokerResponds(data -> data.getFuture().complete(new CorrelationData.Confirm(true, null)));
        assertThatCode(() -> new AgentRunTaskPublisher(template, properties).publish(task)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Broker 拒收和没有匹配路由都不能报告成功")
    void rejectsNackAndUnroutableMessage() {
        brokerResponds(data -> data.getFuture().complete(new CorrelationData.Confirm(false, "nack")));
        assertThatThrownBy(() -> new AgentRunTaskPublisher(template, properties).publish(task)).isInstanceOf(AmqpException.class);
        brokerResponds(data -> {
            data.setReturned(new ReturnedMessage(new Message(new byte[0], new MessageProperties()),
                    312, "NO_ROUTE", "k12.agent", "missing"));
            data.getFuture().complete(new CorrelationData.Confirm(true, null));
        });
        assertThatThrownBy(() -> new AgentRunTaskPublisher(template, properties).publish(task)).isInstanceOf(AmqpException.class);
    }

    @Test
    @DisplayName("确认超时标记为投递不确定，不能等同 Broker 拒收")
    void timeoutIsUnconfirmed() {
        properties.setPublishConfirmTimeoutMs(1);
        assertThatThrownBy(() -> new AgentRunTaskPublisher(template, properties).publish(task))
                .isInstanceOf(AgentPublishUnconfirmedException.class);
    }
}
