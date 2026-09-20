import math
from typing import Any

import httpx

from k12_agent_runtime.domain.rag import DocumentCandidate, EmbeddingBatch, RankedDocument
from k12_agent_runtime.infrastructure.rag.errors import RagModelError


class DashScopeEmbedder:
    """通过百炼OpenAI兼容接口生成文本向量，不在本地加载模型。"""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        dimension: int = 1024,
        batch_size: int = 10,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not base_url.strip() or not api_key.strip() or not model.strip():
            raise ValueError("百炼Embedding的base_url、api_key和model均不能为空")
        if not 1 <= batch_size <= 10:
            raise ValueError("百炼text-embedding-v4单批数量必须在1到10之间")
        if dimension <= 0:
            raise ValueError("Embedding维度必须大于0")
        self._endpoint = f"{base_url.rstrip('/')}/embeddings"
        self._api_key = api_key
        self._model = model
        self._dimension = dimension
        self._batch_size = batch_size
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def embed(self, texts: tuple[str, ...]) -> EmbeddingBatch:
        if not texts:
            return EmbeddingBatch(model=self._model, dimension=self._dimension, vectors=())

        vectors: list[tuple[float, ...]] = []
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                for start in range(0, len(texts), self._batch_size):
                    batch = texts[start : start + self._batch_size]
                    response = await client.post(
                        self._endpoint,
                        headers={"Authorization": f"Bearer {self._api_key}"},
                        json={
                            "model": self._model,
                            "input": list(batch),
                            "dimensions": self._dimension,
                            "encoding_format": "float",
                        },
                    )
                    response.raise_for_status()
                    vectors.extend(self._parse_vectors(response.json(), len(batch)))
        except httpx.TimeoutException as exc:
            raise RagModelError("embedding_timeout") from exc
        except httpx.HTTPStatusError as exc:
            raise RagModelError("embedding_provider_http_error", exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise RagModelError("embedding_network_error") from exc
        except RagModelError:
            raise
        except (KeyError, TypeError, ValueError) as exc:
            raise RagModelError("embedding_invalid_response") from exc

        return EmbeddingBatch(
            model=self._model,
            dimension=self._dimension,
            vectors=tuple(vectors),
        )

    def _parse_vectors(self, body: dict[str, Any], expected_count: int) -> list[tuple[float, ...]]:
        data = body["data"]
        if not isinstance(data, list) or len(data) != expected_count:
            raise RagModelError("embedding_invalid_response")
        ordered = sorted(data, key=lambda item: item["index"])
        if [item["index"] for item in ordered] != list(range(expected_count)):
            raise RagModelError("embedding_invalid_response")

        result: list[tuple[float, ...]] = []
        for item in ordered:
            raw = item["embedding"]
            if not isinstance(raw, list) or len(raw) != self._dimension:
                raise RagModelError("embedding_dimension_mismatch")
            vector = tuple(float(value) for value in raw)
            if not all(math.isfinite(value) for value in vector):
                raise RagModelError("embedding_invalid_response")
            result.append(vector)
        return result


class DashScopeReranker:
    """通过百炼兼容接口对pgvector召回的候选片段做二次排序。"""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        instruction: str,
        timeout_seconds: float = 30.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not base_url.strip() or not api_key.strip() or not model.strip():
            raise ValueError("百炼Reranker的base_url、api_key和model均不能为空")
        self._endpoint = f"{base_url.rstrip('/')}/reranks"
        self._api_key = api_key
        self._model = model
        self._instruction = instruction.strip()
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def rerank(
        self,
        query: str,
        documents: tuple[DocumentCandidate, ...],
        top_k: int,
    ) -> tuple[RankedDocument, ...]:
        if not documents:
            return ()
        payload: dict[str, Any] = {
            "model": self._model,
            "query": query,
            "documents": [document.text for document in documents],
            "top_n": min(top_k, len(documents)),
        }
        if self._instruction:
            payload["instruct"] = self._instruction
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_seconds,
                transport=self._transport,
            ) as client:
                response = await client.post(
                    self._endpoint,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
            response.raise_for_status()
            return self._parse_results(response.json(), documents, top_k)
        except httpx.TimeoutException as exc:
            raise RagModelError("rerank_timeout") from exc
        except httpx.HTTPStatusError as exc:
            raise RagModelError("rerank_provider_http_error", exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise RagModelError("rerank_network_error") from exc
        except RagModelError:
            raise
        except (KeyError, TypeError, ValueError) as exc:
            raise RagModelError("rerank_invalid_response") from exc

    @staticmethod
    def _parse_results(
        body: dict[str, Any],
        documents: tuple[DocumentCandidate, ...],
        top_k: int,
    ) -> tuple[RankedDocument, ...]:
        results = body["results"]
        if not isinstance(results, list):
            raise RagModelError("rerank_invalid_response")
        ranked: list[RankedDocument] = []
        used_indices: set[int] = set()
        for item in results[:top_k]:
            index = int(item["index"])
            score = float(item["relevance_score"])
            invalid = (
                index < 0
                or index >= len(documents)
                or index in used_indices
                or not math.isfinite(score)
            )
            if invalid:
                raise RagModelError("rerank_invalid_response")
            used_indices.add(index)
            document = documents[index]
            ranked.append(
                RankedDocument(
                    document_id=document.document_id,
                    text=document.text,
                    rerank_score=score,
                    metadata=dict(document.metadata),
                    retrieval_score=document.retrieval_score,
                )
            )
        return tuple(ranked)
