package com.k12.platform.agent.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;

/** 仅在显式启用异步 Agent 时声明 RabbitMQ 拓扑，日常同步开发不依赖 RabbitMQ。 */
@Configuration
@ConditionalOnProperty(prefix = "k12.agent.rabbitmq", name = "enabled", havingValue = "true")
public class AgentRabbitConfiguration {

    @Bean
    public TopicExchange agentExchange(AgentRabbitProperties properties) {
        return new TopicExchange(properties.getExchange(), true, false);
    }

    @Bean
    public TopicExchange agentDeadLetterExchange(AgentRabbitProperties properties) {
        return new TopicExchange(properties.getDeadLetterExchange(), true, false);
    }

    @Bean
    public Queue agentRequestQueue(AgentRabbitProperties properties) {
        return QueueBuilder.durable(properties.getRequestQueue())
                .deadLetterExchange(properties.getDeadLetterExchange())
                .build();
    }

    @Bean
    public Queue agentResultQueue(AgentRabbitProperties properties) {
        return QueueBuilder.durable(properties.getResultQueue())
                .deadLetterExchange(properties.getDeadLetterExchange())
                .build();
    }

    @Bean
    public Queue agentDeadLetterQueue(AgentRabbitProperties properties) {
        return QueueBuilder.durable(properties.getDeadLetterQueue()).build();
    }

    @Bean
    public Binding agentRequestBinding(
            @Qualifier("agentRequestQueue") Queue agentRequestQueue,
            @Qualifier("agentExchange") TopicExchange agentExchange,
            AgentRabbitProperties properties
    ) {
        return BindingBuilder.bind(agentRequestQueue)
                .to(agentExchange)
                .with(properties.getRequestRoutingKey());
    }

    @Bean
    public Binding agentResultBinding(
            @Qualifier("agentResultQueue") Queue agentResultQueue,
            @Qualifier("agentExchange") TopicExchange agentExchange,
            AgentRabbitProperties properties
    ) {
        return BindingBuilder.bind(agentResultQueue)
                .to(agentExchange)
                .with(properties.getResultRoutingKey());
    }

    @Bean
    public Binding agentDeadLetterBinding(
            @Qualifier("agentDeadLetterQueue") Queue agentDeadLetterQueue,
            @Qualifier("agentDeadLetterExchange") TopicExchange agentDeadLetterExchange
    ) {
        return BindingBuilder.bind(agentDeadLetterQueue)
                .to(agentDeadLetterExchange)
                .with("#");
    }

    @Bean
    public Jackson2JsonMessageConverter agentMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}
