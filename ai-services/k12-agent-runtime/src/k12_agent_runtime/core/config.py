from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="K12_AGENT_",
        extra="ignore",
    )

    app_name: str = "k12-agent-runtime"
    environment: str = "local"
    host: str = "127.0.0.1"
    port: int = 8090
    log_level: str = "INFO"

    # 大模型配置。API Key 使用 SecretStr，避免在配置对象或异常日志中被直接打印。
    llm_provider: str = ""
    llm_base_url: str = ""
    llm_api_key: SecretStr | None = None
    llm_model: str = ""
    llm_timeout_seconds: float = 30.0
    llm_max_output_tokens: int = 1200
    llm_temperature: float = 0.2

    # RAG模型按第一次请求延迟加载，服务启动时不会立即占用显存。
    rag_enabled: bool = False
    embedding_model: str = "BAAI/bge-m3"
    embedding_device: str = "cuda"
    embedding_use_fp16: bool = True
    embedding_batch_size: int = 8
    embedding_max_length: int = 1024
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_device: str = "cuda"
    reranker_use_fp16: bool = True
    reranker_batch_size: int = 4
    reranker_max_length: int = 512
    model_cache_dir: str | None = None

    # When configured, Java internal calls must send X-Internal-Api-Key.
    internal_api_key: SecretStr | None = None

    rabbitmq_enabled: bool = False
    rabbitmq_url: SecretStr = SecretStr(
        "amqp://k12:k12_dev_only_change_me@127.0.0.1:5672/k12"
    )
    rabbitmq_exchange: str = "k12.agent"
    rabbitmq_request_queue: str = "k12.agent.run.request"
    rabbitmq_request_routing_key: str = "agent.run.request"
    rabbitmq_result_queue: str = "k12.agent.run.result"
    rabbitmq_result_routing_key: str = "agent.run.result"
    rabbitmq_dead_letter_exchange: str = "k12.agent.dlx"
    rabbitmq_dead_letter_queue: str = "k12.agent.run.dead"
    rabbitmq_prefetch_count: int = 4

    # This flag stays false until an isolated sandbox adapter is implemented.
    sandbox_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
