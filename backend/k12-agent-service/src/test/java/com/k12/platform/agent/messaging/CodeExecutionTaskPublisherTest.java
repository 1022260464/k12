package com.k12.platform.agent.messaging;

import com.k12.platform.agent.config.AgentRabbitProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CodeExecutionTaskPublisherTest {

    @Test
    @DisplayName("代码任务发布到独立routing key并等待Broker确认")
    void publishUsesDedicatedRoute() {
        RabbitTemplate template = mock(RabbitTemplate.class);
        AgentRabbitProperties properties = new AgentRabbitProperties();
        CodeExecutionTaskMessage task = new CodeExecutionTaskMessage(
                "run-code-1", "print(1)", 10, List.of()
        );
        doAnswer(invocation -> {
            CorrelationData correlation = invocation.getArgument(4);
            correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
            return null;
        }).when(template).convertAndSend(
                any(String.class), any(String.class), any(Object.class),
                any(MessagePostProcessor.class), any(CorrelationData.class)
        );

        assertThatCode(() -> new CodeExecutionTaskPublisher(template, properties).publish(task))
                .doesNotThrowAnyException();

        verify(template).convertAndSend(
                eq("k12.agent"), eq("code.execute.request"), eq(task),
                any(MessagePostProcessor.class), any(CorrelationData.class)
        );
    }
}
