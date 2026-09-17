import asyncio

from k12_agent_runtime.domain.rag import DocumentCandidate
from k12_agent_runtime.infrastructure.rag import BgeM3Embedder, BgeReranker


class FakeArray:
    def __init__(self, values: list[list[float]]) -> None:
        self._values = values

    def tolist(self) -> list[list[float]]:
        return self._values


class FakeEmbeddingModel:
    def encode(self, texts: list[str], **options: object) -> FakeArray:
        assert texts == ["人工智能", "机器学习"]
        assert options["normalize_embeddings"] is True
        assert options["batch_size"] == 8
        return FakeArray([[1.0, 0.0], [0.6, 0.8]])


def test_bge_embedder_returns_domain_batch() -> None:
    embedder = BgeM3Embedder(
        model_name="BAAI/bge-m3",
        device="cuda",
        use_fp16=True,
        batch_size=8,
        max_length=1024,
        model_loader=FakeEmbeddingModel,
    )

    result = asyncio.run(embedder.embed(("人工智能", "机器学习")))

    assert result.model == "BAAI/bge-m3"
    assert result.dimension == 2
    assert result.vectors == ((1.0, 0.0), (0.6, 0.8))


def test_bge_reranker_sorts_and_limits_candidates() -> None:
    def score(_query: str, texts: tuple[str, ...]) -> list[float]:
        assert len(texts) == 3
        return [0.2, 0.95, 0.5]

    reranker = BgeReranker(
        model_name="BAAI/bge-reranker-v2-m3",
        device="cuda",
        use_fp16=True,
        batch_size=4,
        max_length=512,
        scorer=score,
    )
    documents = tuple(
        DocumentCandidate(document_id=str(index), text=f"片段{index}")
        for index in range(3)
    )

    result = asyncio.run(reranker.rerank("什么是机器学习", documents, top_k=2))

    assert [item.document_id for item in result] == ["1", "2"]
    assert [item.rerank_score for item in result] == [0.95, 0.5]
