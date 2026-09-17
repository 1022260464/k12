from dataclasses import dataclass

from k12_agent_runtime.domain.rag import EmbeddingBatch, TextEmbedder


class RagDisabledError(RuntimeError):
    """当前环境没有启用本地RAG模型。"""


@dataclass(frozen=True, slots=True)
class EmbedTextsCommand:
    texts: tuple[str, ...]


class EmbedTextsUseCase:
    def __init__(self, embedder: TextEmbedder | None) -> None:
        self._embedder = embedder

    async def execute(self, command: EmbedTextsCommand) -> EmbeddingBatch:
        if self._embedder is None:
            raise RagDisabledError("本地RAG模型尚未启用")
        texts = tuple(text.strip() for text in command.texts)
        if not texts or any(not text for text in texts):
            raise ValueError("待向量化文本不能为空")
        return await self._embedder.embed(texts)
