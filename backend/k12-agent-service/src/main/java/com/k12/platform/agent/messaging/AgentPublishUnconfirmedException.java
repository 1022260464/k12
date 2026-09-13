package com.k12.platform.agent.messaging;

import org.springframework.amqp.AmqpException;

/** Broker 可能已经接收任务，只是确认没有及时返回；调用方不得据此自动重发。 */
public class AgentPublishUnconfirmedException extends AmqpException {
    public AgentPublishUnconfirmedException(String message, Throwable cause) {
        super(message, cause);
    }
}
