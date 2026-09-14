from dataclasses import dataclass

from k12_agent_runtime.application.rag.embed_texts import RagDisabledError
from k12_agent_runtime.domain.rag import DocumentCandidate, DocumentReranker, RankedDocument


@dataclass(frozen=True, slots=True)
class RerankDocumentsCommand:
    query: str
    documents: tuple[DocumentCandidate, ...]
    top_k: int


class RerankDocumentsUseCase:
    def __init__(self, reranker: DocumentReranker | None) -> None:
        self._reranker = reranker

    async def execute(
        self,
        command: RerankDocumentsCommand,
    ) -> tuple[RankedDocument, ...]:
        if self._reranker is None:
            raise RagDisabledError("本地RAG模型尚未启用")
        query = command.query.strip()
        if not query:
            raise ValueError("重排查询不能为空")
        if not command.documents:
            return ()
        top_k = min(max(command.top_k, 1), len(command.documents))
        return await self._reranker.rerank(query, command.documents, top_k)
