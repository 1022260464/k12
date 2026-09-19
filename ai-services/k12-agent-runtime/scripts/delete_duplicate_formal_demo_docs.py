"""删除与已入库教学资料重复的 formal-demo 向量文档。"""

from __future__ import annotations

import asyncio

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.rag import PgVectorKnowledgeRepository

# 已由管理端真实 PDF 入库的主题，以及仅作邻居扩展、不应再出现在推荐里的 seed。
DUPLICATE_DEMO_IDS = (
    "formal-demo-doc-what-is-data",
    "formal-demo-doc-features-labels",
    "formal-demo-doc-prompt-basics",
    "formal-demo-doc-privacy-basics",
    "formal-demo-doc-algorithm-basics",
    "formal-demo-doc-supervised-learning",
)


async def main() -> None:
    settings = Settings()
    if settings.rag_database_url is None:
        raise RuntimeError("请配置 K12_AGENT_RAG_DATABASE_URL")
    repo = PgVectorKnowledgeRepository(
        database_url=settings.rag_database_url.get_secret_value(),
        min_pool_size=settings.rag_database_min_pool_size,
        max_pool_size=settings.rag_database_max_pool_size,
    )
    try:
        for document_id in DUPLICATE_DEMO_IDS:
            deleted = await repo.delete_document(document_id)
            print(f"{document_id}: {'deleted' if deleted else 'not_found'}")
    finally:
        await repo.close()


if __name__ == "__main__":
    asyncio.run(main())
