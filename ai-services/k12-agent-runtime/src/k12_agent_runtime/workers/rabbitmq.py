import asyncio

from k12_agent_runtime.bootstrap.container import build_container
from k12_agent_runtime.core.config import get_settings
from k12_agent_runtime.core.logging import configure_logging
from k12_agent_runtime.infrastructure.messaging.rabbitmq_worker import RabbitMqAgentWorker


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    if not settings.rabbitmq_enabled:
        raise SystemExit(
            "RabbitMQ worker is disabled. Set K12_AGENT_RABBITMQ_ENABLED=true."
        )

    container = build_container(settings)
    worker = RabbitMqAgentWorker(settings, container.run_agent, container.execute_code)
    asyncio.run(worker.run_forever())


if __name__ == "__main__":
    main()
