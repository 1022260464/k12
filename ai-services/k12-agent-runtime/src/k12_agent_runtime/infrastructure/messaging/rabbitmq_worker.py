import asyncio
import logging

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from k12_agent_runtime.application.agents.run_agent import RunAgentCommand, RunAgentUseCase
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.messaging.messages import (
    AgentRunResultMessage,
    AgentRunTaskMessage,
)

logger = logging.getLogger(__name__)


class RabbitMqAgentWorker:
    """Consumes agent commands and publishes normalized execution results."""

    def __init__(self, settings: Settings, run_agent: RunAgentUseCase) -> None:
        self._settings = settings
        self._run_agent = run_agent
        self._result_exchange: AbstractRobustExchange | None = None

    async def run_forever(self) -> None:
        connection = await aio_pika.connect_robust(
            self._settings.rabbitmq_url.get_secret_value()
        )
        async with connection:
            channel = await connection.channel()
            await channel.set_qos(
                prefetch_count=self._settings.rabbitmq_prefetch_count
            )

            exchange = await channel.declare_exchange(
                self._settings.rabbitmq_exchange,
                ExchangeType.TOPIC,
                durable=True,
            )
            dead_letter_exchange = await channel.declare_exchange(
                self._settings.rabbitmq_dead_letter_exchange,
                ExchangeType.TOPIC,
                durable=True,
            )
            request_queue = await channel.declare_queue(
                self._settings.rabbitmq_request_queue,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": dead_letter_exchange.name,
                },
            )
            result_queue = await channel.declare_queue(
                self._settings.rabbitmq_result_queue,
                durable=True,
            )
            dead_letter_queue = await channel.declare_queue(
                self._settings.rabbitmq_dead_letter_queue,
                durable=True,
            )

            await request_queue.bind(
                exchange,
                routing_key=self._settings.rabbitmq_request_routing_key,
            )
            await result_queue.bind(
                exchange,
                routing_key=self._settings.rabbitmq_result_routing_key,
            )
            await dead_letter_queue.bind(dead_letter_exchange, routing_key="#")

            self._result_exchange = exchange
            await request_queue.consume(self._handle_message)
            logger.info(
                "RabbitMQ worker is consuming queue=%s",
                self._settings.rabbitmq_request_queue,
            )
            await asyncio.Future()

    async def _handle_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            # Validation errors are intentionally raised so malformed messages
            # are rejected and routed to the dead-letter queue.
            task = AgentRunTaskMessage.model_validate_json(message.body)
            try:
                result = await self._run_agent.execute(
                    RunAgentCommand(
                        run_id=task.run_id,
                        agent_code=task.agent_code,
                        input_text=task.input_text,
                        user_id=task.user_id,
                        context=task.context,
                    )
                )
                result_message = AgentRunResultMessage.from_domain(result)
            except Exception as error:  # noqa: BLE001
                logger.exception("Agent task failed run_id=%s", task.run_id)
                result_message = AgentRunResultMessage.failed(
                    task,
                    f"{type(error).__name__}: {error}",
                )

            await self._publish_result(result_message)

    async def _publish_result(self, result: AgentRunResultMessage) -> None:
        if self._result_exchange is None:
            raise RuntimeError("RabbitMQ result exchange is not initialized")

        await self._result_exchange.publish(
            Message(
                body=result.model_dump_json(by_alias=True).encode("utf-8"),
                content_type="application/json",
                delivery_mode=DeliveryMode.PERSISTENT,
                correlation_id=result.run_id,
            ),
            routing_key=self._settings.rabbitmq_result_routing_key,
        )
