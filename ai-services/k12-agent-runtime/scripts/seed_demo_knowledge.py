"""将仓库内置的演示课程资料写入pgvector知识库。"""

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from k12_agent_runtime.application.rag import IndexDocumentCommand, IndexDocumentUseCase
from k12_agent_runtime.application.rag.chunk_text import TextChunker
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.rag import KnowledgeDocument
from k12_agent_runtime.infrastructure.rag import BgeM3Embedder, PgVectorKnowledgeRepository

DEFAULT_DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "demo_knowledge.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="写入K12 AI通识演示知识")
    parser.add_argument(
        "--data-file",
        type=Path,
        default=DEFAULT_DATA_FILE,
        help="演示知识JSON文件路径",
    )
    return parser.parse_args()


def load_documents(path: Path) -> tuple[KnowledgeDocument, ...]:
    raw_items: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_items, list) or not raw_items:
        raise ValueError("演示知识文件必须是非空JSON数组")

    documents: list[KnowledgeDocument] = []
    document_ids: set[str] = set()
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"第{index}条演示知识必须是JSON对象")
        document = KnowledgeDocument(**item)
        if document.document_id in document_ids:
            raise ValueError(f"演示知识document_id重复：{document.document_id}")
        document_ids.add(document.document_id)
        documents.append(document)
    return tuple(documents)


async def seed(data_file: Path) -> None:
    settings = Settings()
    if not settings.rag_enabled:
        raise RuntimeError("请先设置K12_AGENT_RAG_ENABLED=true")
    if settings.rag_database_url is None:
        raise RuntimeError("请先配置K12_AGENT_RAG_DATABASE_URL")

    documents = load_documents(data_file)
    embedder = BgeM3Embedder(
        model_name=settings.embedding_model,
        device=settings.embedding_device,
        use_fp16=settings.embedding_use_fp16,
        batch_size=settings.embedding_batch_size,
        max_length=settings.embedding_max_length,
        cache_dir=settings.model_cache_dir,
    )
    repository = PgVectorKnowledgeRepository(
        database_url=settings.rag_database_url.get_secret_value(),
        min_pool_size=settings.rag_database_min_pool_size,
        max_pool_size=settings.rag_database_max_pool_size,
    )
    use_case = IndexDocumentUseCase(
        embedder=embedder,
        repository=repository,
        chunker=TextChunker(settings.rag_chunk_size, settings.rag_chunk_overlap),
    )

    total_chunks = 0
    try:
        for index, document in enumerate(documents, start=1):
            result = await use_case.execute(IndexDocumentCommand(document=document))
            total_chunks += result.chunk_count
            print(
                f"[{index}/{len(documents)}] {document.document_id}: "
                f"{result.chunk_count} chunks"
            )
    finally:
        await repository.close()

    print(f"演示知识写入完成：documents={len(documents)}, chunks={total_chunks}")


def main() -> None:
    args = parse_args()
    asyncio.run(seed(args.data_file.resolve()))


if __name__ == "__main__":
    main()
