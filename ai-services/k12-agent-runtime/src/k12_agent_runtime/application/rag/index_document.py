import logging
from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from k12_agent_runtime.application.rag.chunk_text import TextChunker
from k12_agent_runtime.application.rag.embed_texts import RagDisabledError
from k12_agent_runtime.domain.rag import (
    IndexedDocument,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeRepository,
    KnowledgeSearchCache,
    TextEmbedder,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class IndexDocumentCommand:
    document: KnowledgeDocument


class IndexDocumentUseCase:
    def __init__(
        self,
        embedder: TextEmbedder | None,
        repository: KnowledgeRepository | None,
        chunker: TextChunker,
        cache: KnowledgeSearchCache | None = None,
    ) -> None:
        self._embedder = embedder
        self._repository = repository
        self._chunker = chunker
        self._cache = cache

    async def execute(self, command: IndexDocumentCommand) -> IndexedDocument:
        if self._embedder is None or self._repository is None:
            raise RagDisabledError("RAG知识库存储尚未启用")
        document = command.document
        chunks = self._chunker.split_structured(document.content, document.sections)
        if not chunks:
            raise ValueError("知识文档内容不能为空")

        embeddings = await self._embedder.embed(tuple(chunk.text for chunk in chunks))
        knowledge_chunks = tuple(
            KnowledgeChunk(
                chunk_id=str(
                    uuid5(NAMESPACE_URL, f"k12:{document.document_id}:{index}:{chunk.text}")
                ),
                document_id=document.document_id,
                chunk_index=index,
                title=document.title,
                content=chunk.text,
                embedding=embedding,
                embedding_model=embeddings.model,
                source_uri=document.source_uri,
                stage_code=document.stage_code,
                grade=document.grade,
                textbook=document.textbook,
                chapter=document.chapter,
                metadata={**document.metadata, **chunk.metadata},
            )
            for index, (chunk, embedding) in enumerate(
                zip(chunks, embeddings.vectors, strict=True)
            )
        )
        await self._repository.replace_document(document, knowledge_chunks)
        if self._cache is not None:
            try:
                # 通过版本号失效，不扫描或批量删除线上Redis键。
                await self._cache.invalidate()
            except Exception:  # noqa: BLE001
                logger.warning("RAG cache invalidation failed after indexing", exc_info=True)
        return IndexedDocument(
            document_id=document.document_id,
            chunk_count=len(knowledge_chunks),
            embedding_model=embeddings.model,
        )
