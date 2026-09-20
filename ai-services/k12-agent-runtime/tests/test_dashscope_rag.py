import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from k12_agent_runtime.bootstrap.container import _build_rag_models
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.rag import DocumentCandidate
from k12_agent_runtime.infrastructure.rag import DashScopeEmbedder, DashScopeReranker


def test_container_builds_cloud_rag_adapters_and_reuses_llm_key() -> None:
    settings = Settings(
        _env_file=None,
        rag_enabled=True,
        llm_api_key=SecretStr("shared-key"),
        embedding_provider="dashscope",
        embedding_model="text-embedding-v4",
        reranker_provider="dashscope",
        reranker_model="qwen3-rerank",
    )

    embedder, reranker = _build_rag_models(settings)

    assert isinstance(embedder, DashScopeEmbedder)
    assert isinstance(reranker, DashScopeReranker)


def test_cloud_rag_configuration_requires_an_api_key() -> None:
    settings = Settings(
        _env_file=None,
        rag_enabled=True,
        embedding_provider="dashscope",
        embedding_model="text-embedding-v4",
        reranker_provider="dashscope",
        reranker_model="qwen3-rerank",
    )

    with pytest.raises(ValueError, match="api_key"):
        _build_rag_models(settings)


def test_dashscope_embedder_batches_and_preserves_provider_order() -> None:
    requests: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        requests.append(payload)
        start = 0 if len(requests) == 1 else 2
        data = [
            {"index": index, "embedding": [float(start + index), 1.0, 2.0]}
            for index in reversed(range(len(payload["input"])))
        ]
        return httpx.Response(200, json={"model": "text-embedding-v4", "data": data})

    embedder = DashScopeEmbedder(
        base_url="https://example.test/compatible-mode/v1",
        api_key="secret",
        model="text-embedding-v4",
        dimension=3,
        batch_size=2,
        transport=httpx.MockTransport(handler),
    )

    result = asyncio.run(embedder.embed(("一", "二", "三")))

    assert len(requests) == 2
    assert requests[0]["dimensions"] == 3
    assert result.dimension == 3
    assert result.vectors == ((0.0, 1.0, 2.0), (1.0, 1.0, 2.0), (2.0, 1.0, 2.0))


def test_dashscope_reranker_maps_provider_indices_to_candidates() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["model"] == "qwen3-rerank"
        assert payload["top_n"] == 2
        assert payload["documents"] == ["片段0", "片段1", "片段2"]
        return httpx.Response(
            200,
            json={
                "results": [
                    {"index": 2, "relevance_score": 0.91},
                    {"index": 0, "relevance_score": 0.62},
                ]
            },
        )

    reranker = DashScopeReranker(
        base_url="https://example.test/compatible-api/v1",
        api_key="secret",
        model="qwen3-rerank",
        instruction="Retrieve answers.",
        transport=httpx.MockTransport(handler),
    )
    documents = tuple(
        DocumentCandidate(
            document_id=str(index),
            text=f"片段{index}",
            metadata={"index": index},
            retrieval_score=0.5,
        )
        for index in range(3)
    )

    result = asyncio.run(reranker.rerank("测试问题", documents, 2))

    assert [item.document_id for item in result] == ["2", "0"]
    assert [item.rerank_score for item in result] == [0.91, 0.62]
    assert result[0].metadata == {"index": 2}
