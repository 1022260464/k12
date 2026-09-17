"""缓存基础设施适配器。"""

from k12_agent_runtime.infrastructure.cache.redis_rag_cache import (
    RedisKnowledgeSearchCache,
)

__all__ = ["RedisKnowledgeSearchCache"]
