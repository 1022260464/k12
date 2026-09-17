import asyncio

from k12_agent_runtime.application.rag.chunk_text import TextChunker
from k12_agent_runtime.application.rag.index_document import (
    IndexDocumentCommand,
    IndexDocumentUseCase,
)
from k12_agent_runtime.application.rag.search_knowledge import (
    SearchKnowledgeCommand,
    SearchKnowledgeUseCase,
)
from k12_agent_runtime.domain.rag import (
    DocumentCandidate,
    EmbeddingBatch,
    KnowledgeDocument,
    KnowledgeSearchResult,
    RankedDocument,
)


class FakeEmbedder:
    async def embed(self, texts: tuple[str, ...]) -> EmbeddingBatch:
        vectors = tuple((float(index + 1), 0.0) for index, _text in enumerate(texts))
        return EmbeddingBatch(model="test-embedding", dimension=2, vectors=vectors)


class FakeRepository:
    def __init__(self) -> None:
        self.document: KnowledgeDocument | None = None
        self.chunks = ()
        self.last_query = None

    async def replace_document(self, document, chunks) -> None:
        self.document = document
        self.chunks = chunks

    async def search(self, query):
        self.last_query = query
        return (
            DocumentCandidate(document_id="chunk-low", text="无关片段", retrieval_score=0.4),
            DocumentCandidate(document_id="chunk-high", text="相关片段", retrieval_score=0.8),
        )

    async def delete_document(self, _document_id: str) -> bool:
        return True

    async def close(self) -> None:
        return None


class FakeReranker:
    async def rerank(self, _query, documents, top_k):
        ranked = tuple(
            RankedDocument(
                document_id=document.document_id,
                text=document.text,
                rerank_score=1.0 if document.document_id == "chunk-high" else 0.1,
                metadata=document.metadata,
                retrieval_score=document.retrieval_score,
            )
            for document in documents
        )
        return tuple(sorted(ranked, key=lambda item: item.rerank_score, reverse=True)[:top_k])


class FakeCache:
    def __init__(self, result=None) -> None:
        self.result = result
        self.invalidations = 0
        self.writes = 0

    async def get(self, _cache_key):
        return self.result

    async def set(self, _cache_key, result, _ttl_seconds):
        self.result = result
        self.writes += 1

    async def invalidate(self):
        self.invalidations += 1

    async def close(self):
        return None


def test_text_chunker_keeps_overlap_and_limits_size() -> None:
    chunker = TextChunker(chunk_size=100, overlap=20)
    content = "人工智能课程。" * 30

    chunks = chunker.split(content)

    assert len(chunks) > 1
    assert all(len(chunk) <= 100 for chunk in chunks)
    assert chunks[0][-20:].strip() in chunks[1]


def test_index_document_chunks_embeds_and_replaces_atomically() -> None:
    repository = FakeRepository()
    cache = FakeCache()
    use_case = IndexDocumentUseCase(
        FakeEmbedder(),
        repository,
        TextChunker(chunk_size=100, overlap=20),
        cache,
    )
    document = KnowledgeDocument(
        document_id="doc-1",
        title="人工智能入门",
        content="机器通过数据学习规律。" * 20,
        source_type="manual",
        stage_code="middle_school",
    )

    result = asyncio.run(use_case.execute(IndexDocumentCommand(document)))

    assert repository.document == document
    assert result.chunk_count == len(repository.chunks)
    assert result.chunk_count > 1
    assert all(chunk.embedding_model == "test-embedding" for chunk in repository.chunks)
    assert len({chunk.chunk_id for chunk in repository.chunks}) == result.chunk_count
    assert cache.invalidations == 1


def test_search_applies_filters_then_reranks_candidates() -> None:
    repository = FakeRepository()
    use_case = SearchKnowledgeUseCase(FakeEmbedder(), FakeReranker(), repository)

    result = asyncio.run(
        use_case.execute(
            SearchKnowledgeCommand(
                query="什么是机器学习？",
                candidate_count=20,
                top_k=1,
                stage_code="middle_school",
                grade="八年级",
                textbook="AI通识",
            )
        )
    )

    assert result.candidate_count == 2
    assert result.documents[0].document_id == "chunk-high"
    assert repository.last_query.embedding_model == "test-embedding"
    assert repository.last_query.stage_code == "middle_school"
    assert repository.last_query.grade == "八年级"


def test_search_returns_cached_result_without_querying_repository() -> None:
    repository = FakeRepository()
    cached = KnowledgeSearchResult(
        query="什么是机器学习？",
        embedding_model="test-embedding",
        candidate_count=1,
        documents=(
            RankedDocument(
                document_id="cached-chunk",
                text="缓存内容",
                rerank_score=0.9,
            ),
        ),
    )
    use_case = SearchKnowledgeUseCase(
        FakeEmbedder(),
        FakeReranker(),
        repository,
        FakeCache(cached),
    )

    result = asyncio.run(
        use_case.execute(
            SearchKnowledgeCommand(
                query="什么是机器学习？",
                candidate_count=20,
                top_k=5,
            )
        )
    )

    assert result == cached
    assert repository.last_query is None
