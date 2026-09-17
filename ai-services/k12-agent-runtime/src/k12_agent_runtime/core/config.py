from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        # IDEA从仓库根目录启动时，也要读取Runtime模块自己的.env。
        env_file=(".env", Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        env_prefix="K12_AGENT_",
        extra="ignore",
        populate_by_name=True,
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
    rag_database_url: SecretStr | None = None
    rag_database_min_pool_size: int = 1
    rag_database_max_pool_size: int = 5
    rag_candidate_count: int = 20
    rag_top_k: int = 5
    rag_chunk_size: int = 800
    rag_chunk_overlap: int = 120

    # Redis只保存可丢失的热点数据。RAG原始文档和业务积分不能只存在Redis中。
    redis_enabled: bool = False
    redis_url: SecretStr | None = None
    redis_key_prefix: str = "k12:agent-runtime"
    redis_connect_timeout_seconds: float = 3.0
    rag_cache_ttl_seconds: int = 300

    # MongoDB保存结构变化频繁的Agent执行轨迹，不代替MySQL中的业务运行状态。
    mongodb_enabled: bool = False
    mongodb_url: SecretStr | None = None
    mongodb_database: str = "k12_agent"
    mongodb_trace_collection: str = "agent_run_trace"
    mongodb_connect_timeout_ms: int = 3000
    mongodb_trace_retention_days: int = 30

    # MinIO保存图片、音视频和文档等大对象，数据库中只保存对象键或URI。
    minio_enabled: bool = False
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: SecretStr | None = None
    minio_secret_key: SecretStr | None = None
    minio_secure: bool = False
    minio_bucket: str = "k12-agent-artifacts"
    minio_region: str | None = None
    minio_connect_timeout_seconds: float = 5.0
    minio_max_upload_bytes: int = 52_428_800
    minio_presigned_ttl_seconds: int = 900

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
    # 代码执行使用独立队列，避免和普通Agent消息模型互相污染。
    rabbitmq_code_request_queue: str = "k12.code.execute.request"
    rabbitmq_code_request_routing_key: str = "code.execute.request"
    rabbitmq_code_result_queue: str = "k12.code.execute.result"
    rabbitmq_code_result_routing_key: str = "code.execute.result"
    rabbitmq_dead_letter_exchange: str = "k12.agent.dlx"
    rabbitmq_dead_letter_queue: str = "k12.agent.run.dead"
    rabbitmq_prefetch_count: int = 4

    # 沙箱默认关闭。启用后必须显式选择腾讯云或本地Piston，禁止主进程直接执行代码。
    sandbox_enabled: bool = False
    sandbox_provider: str = "tencent_agsx"
    # 留空表示不降级；配置local_piston后，只有供应商不可用时才切换。
    sandbox_fallback_provider: str = ""
    sandbox_fallback_cooldown_seconds: int = Field(default=60, ge=1, le=3600)
    sandbox_template: str = "k12-python-analysis-v1"
    sandbox_timeout_seconds: int = Field(default=30, ge=1, le=600)
    # 云供应商控制面请求必须短于Java调用Runtime的整体读取超时。
    sandbox_provider_request_timeout_seconds: float = Field(default=30.0, gt=0, le=55)
    sandbox_instance_timeout_seconds: int = Field(default=120, ge=30, le=3600)
    # 单进程/单适配器容量；这不是跨Runtime副本的全局限流。
    sandbox_max_concurrency: int = Field(default=2, ge=1, le=4)
    sandbox_max_waiters: int = Field(default=4, ge=0, le=8)
    sandbox_queue_wait_seconds: float = Field(default=3.0, gt=0, le=5)
    sandbox_max_output_bytes: int = Field(default=1_048_576, ge=1024, le=5_242_880)
    sandbox_max_result_items: int = Field(default=20, ge=1, le=100)
    sandbox_max_artifacts: int = Field(default=5, ge=1, le=20)
    sandbox_max_artifact_bytes: int = Field(default=20_971_520, ge=1024, le=52_428_800)
    e2b_domain: str = Field(
        default="",
        validation_alias=AliasChoices("E2B_DOMAIN", "K12_AGENT_E2B_DOMAIN"),
    )
    e2b_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("E2B_API_KEY", "K12_AGENT_E2B_API_KEY"),
    )
    piston_url: str = "http://127.0.0.1:2000"
    piston_python_version: str = "3.12.0"
    piston_connect_timeout_seconds: float = Field(default=3.0, gt=0, le=30)
    piston_run_timeout_ms: int = Field(default=3000, ge=100, le=600_000)


@lru_cache
def get_settings() -> Settings:
    return Settings()
