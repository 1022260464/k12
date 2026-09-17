import asyncio
import logging
from datetime import UTC, datetime
from uuid import uuid4

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from k12_agent_runtime.application.agents.run_agent import RunAgentCommand, RunAgentUseCase
from k12_agent_runtime.application.sandbox.execute_code import (
    ExecuteCodeCommand,
    ExecuteCodeUseCase,
)
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.messaging.messages import (
    AgentRunResultMessage,
    AgentRunTaskMessage,
    CodeExecutionResultMessage,
    CodeExecutionTaskMessage,
)

logger = logging.getLogger(__name__)


class RabbitMqAgentWorker:
    """Consumes agent commands and publishes normalized execution results."""

    def __init__(
        self,
        settings: Settings,
        run_agent: RunAgentUseCase,
        execute_code: ExecuteCodeUseCase,
    ) -> None:
        self._settings = settings
        self._run_agent = run_agent
        self._execute_code = execute_code
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
                arguments={
                    # Java 消费端拒绝的非法结果也进入统一死信队列。
                    # 同名队列的参数必须与 Java Agent 服务完全一致。
                    "x-dead-letter-exchange": dead_letter_exchange.name,
                },
            )
            code_request_queue = await channel.declare_queue(
                self._settings.rabbitmq_code_request_queue,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": dead_letter_exchange.name,
                },
            )
            code_result_queue = await channel.declare_queue(
                self._settings.rabbitmq_code_result_queue,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": dead_letter_exchange.name,
                },
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
            await code_request_queue.bind(
                exchange,
                routing_key=self._settings.rabbitmq_code_request_routing_key,
            )
            await code_result_queue.bind(
                exchange,
                routing_key=self._settings.rabbitmq_code_result_routing_key,
            )
            await dead_letter_queue.bind(dead_letter_exchange, routing_key="#")

            self._result_exchange = exchange
            await request_queue.consume(self._handle_agent_message)
            await code_request_queue.consume(self._handle_code_message)
            logger.info(
                "RabbitMQ worker is consuming agent_queue=%s code_queue=%s",
                self._settings.rabbitmq_request_queue,
                self._settings.rabbitmq_code_request_queue,
            )
            await asyncio.Future()

    async def _handle_agent_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            # Validation errors are intentionally raised so malformed messages
            # are rejected and routed to the dead-letter queue.
            task = AgentRunTaskMessage.model_validate_json(message.body)
            started_time = datetime.now(UTC)

            # 先通知 Java 任务已经真正被 Worker 取走，便于数据库及时记录
            # RUNNING 状态和 started_time，而不是把排队时间算作执行时间。
            await self._publish_result(
                AgentRunResultMessage.started(task, started_time),
                self._settings.rabbitmq_result_routing_key,
            )
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
                result_message = AgentRunResultMessage.from_domain(
                    result,
                    started_time,
                )
            except Exception as error:  # noqa: BLE001
                logger.exception("Agent task failed run_id=%s", task.run_id)
                result_message = AgentRunResultMessage.failed(
                    task,
                    f"{type(error).__name__}: {error}",
                    started_time,
                )

            await self._publish_result(
                result_message,
                self._settings.rabbitmq_result_routing_key,
            )

    async def _handle_code_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process(requeue=False):
            task = CodeExecutionTaskMessage.model_validate_json(message.body)
            started_time = datetime.now(UTC)
            await self._publish_result(
                CodeExecutionResultMessage.started(task, started_time),
                self._settings.rabbitmq_code_result_routing_key,
            )
            try:
                result = await self._execute_code.execute(
                    ExecuteCodeCommand(
                        code=task.code,
                        timeout_seconds=task.timeout_seconds,
                        packages=tuple(task.packages),
                    )
                )
                result_message = CodeExecutionResultMessage.from_domain(
                    task,
                    result,
                    started_time,
                )
            except Exception:  # noqa: BLE001
                logger.exception("Code execution task failed run_id=%s", task.run_id)
                result_message = CodeExecutionResultMessage.failed(
                    task,
                    str(uuid4()),
                    started_time,
                )
            await self._publish_result(
                result_message,
                self._settings.rabbitmq_code_result_routing_key,
            )

    async def _publish_result(
        self,
        result: AgentRunResultMessage | CodeExecutionResultMessage,
        routing_key: str,
    ) -> None:
        if self._result_exchange is None:
            raise RuntimeError("RabbitMQ result exchange is not initialized")

        await self._result_exchange.publish(
            Message(
                body=result.model_dump_json(by_alias=True).encode("utf-8"),
                content_type="application/json",
                delivery_mode=DeliveryMode.PERSISTENT,
                correlation_id=result.run_id,
            ),
            routing_key=routing_key,
        )
