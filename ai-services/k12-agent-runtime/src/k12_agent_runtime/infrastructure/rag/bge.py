import asyncio
import logging
import math
from collections.abc import Callable
from threading import Lock
from typing import Any

from k12_agent_runtime.domain.rag import (
    DocumentCandidate,
    EmbeddingBatch,
    RankedDocument,
)

logger = logging.getLogger(__name__)


class RagModelError(RuntimeError):
    """对接口层安全的本地模型异常，只暴露稳定错误码。"""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class BgeM3Embedder:
    """使用Sentence Transformers运行本地BGE-M3稠密向量模型。"""

    def __init__(
        self,
        *,
        model_name: str,
        device: str,
        use_fp16: bool,
        batch_size: int,
        max_length: int,
        cache_dir: str | None = None,
        model_loader: Callable[[], Any] | None = None,
    ) -> None:
        self._model_name = model_name
        self._device = device
        self._use_fp16 = use_fp16
        self._batch_size = batch_size
        self._max_length = max_length
        self._cache_dir = cache_dir
        self._model_loader = model_loader
        self._model: Any | None = None
        self._load_lock = Lock()

    async def embed(self, texts: tuple[str, ...]) -> EmbeddingBatch:
        try:
            return await asyncio.to_thread(self._embed_sync, texts)
        except RagModelError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("BGE-M3向量化失败：model=%s device=%s", self._model_name, self._device)
            raise RagModelError("embedding_failed") from exc

    def _embed_sync(self, texts: tuple[str, ...]) -> EmbeddingBatch:
        model = self._get_model()
        vectors = model.encode(
            list(texts),
            batch_size=self._batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        rows = tuple(tuple(float(value) for value in row) for row in vectors.tolist())
        dimension = len(rows[0]) if rows else 0
        return EmbeddingBatch(model=self._model_name, dimension=dimension, vectors=rows)

    def _get_model(self) -> Any:
        if self._model is not None:
            return self._model
        with self._load_lock:
            if self._model is None:
                self._model = (
                    self._model_loader() if self._model_loader else self._load_default_model()
                )
        return self._model

    def _load_default_model(self) -> Any:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise RagModelError("embedding_dependency_missing") from exc

        logger.info("开始加载Embedding模型：model=%s device=%s", self._model_name, self._device)
        model = SentenceTransformer(
            self._model_name,
            device=self._device,
            cache_folder=self._cache_dir,
            trust_remote_code=False,
        )
        model.max_seq_length = self._max_length
        if self._use_fp16 and self._device.startswith("cuda"):
            model.half()
        logger.info("Embedding模型加载完成：model=%s", self._model_name)
        return model


class BgeReranker:
    """使用Transformers运行本地BGE交叉编码重排模型。"""

    def __init__(
        self,
        *,
        model_name: str,
        device: str,
        use_fp16: bool,
        batch_size: int,
        max_length: int,
        cache_dir: str | None = None,
        scorer: Callable[[str, tuple[str, ...]], list[float]] | None = None,
    ) -> None:
        self._model_name = model_name
        self._device = device
        self._use_fp16 = use_fp16
        self._batch_size = batch_size
        self._max_length = max_length
        self._cache_dir = cache_dir
        self._scorer = scorer
        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._torch: Any | None = None
        self._load_lock = Lock()

    async def rerank(
        self,
        query: str,
        documents: tuple[DocumentCandidate, ...],
        top_k: int,
    ) -> tuple[RankedDocument, ...]:
        try:
            scores = await asyncio.to_thread(
                self._score_documents,
                query,
                tuple(document.text for document in documents),
            )
        except RagModelError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.exception("BGE重排失败：model=%s device=%s", self._model_name, self._device)
            raise RagModelError("rerank_failed") from exc

        ranked = [
            RankedDocument(
                document_id=document.document_id,
                text=document.text,
                rerank_score=score,
                metadata=dict(document.metadata),
                retrieval_score=document.retrieval_score,
            )
            for document, score in zip(documents, scores, strict=True)
        ]
        ranked.sort(key=lambda item: item.rerank_score, reverse=True)
        return tuple(ranked[:top_k])

    def _score_documents(self, query: str, texts: tuple[str, ...]) -> list[float]:
        if self._scorer is not None:
            return self._scorer(query, texts)

        self._ensure_loaded()
        scores: list[float] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            pairs = [[query, text] for text in batch]
            inputs = self._tokenizer(
                pairs,
                padding=True,
                truncation=True,
                return_tensors="pt",
                max_length=self._max_length,
            )
            inputs = {name: tensor.to(self._device) for name, tensor in inputs.items()}
            with self._torch.inference_mode():
                logits = self._model(**inputs, return_dict=True).logits.view(-1).float()
            scores.extend(_sigmoid(float(value)) for value in logits.cpu().tolist())
        return scores

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        with self._load_lock:
            if self._model is not None:
                return
            try:
                import torch
                from transformers import AutoModelForSequenceClassification, AutoTokenizer
            except ImportError as exc:
                raise RagModelError("reranker_dependency_missing") from exc

            logger.info("开始加载Reranker模型：model=%s device=%s", self._model_name, self._device)
            self._tokenizer = AutoTokenizer.from_pretrained(
                self._model_name,
                cache_dir=self._cache_dir,
                trust_remote_code=False,
            )
            self._model = AutoModelForSequenceClassification.from_pretrained(
                self._model_name,
                cache_dir=self._cache_dir,
                trust_remote_code=False,
            )
            if self._use_fp16 and self._device.startswith("cuda"):
                self._model.half()
            self._model.to(self._device)
            self._model.eval()
            self._torch = torch
            logger.info("Reranker模型加载完成：model=%s", self._model_name)


def _sigmoid(value: float) -> float:
    """稳定地把原始相关性分数映射到0到1。"""
    if value >= 0:
        return 1.0 / (1.0 + math.exp(-value))
    exp_value = math.exp(value)
    return exp_value / (1.0 + exp_value)
