"""RAG应用用例。"""

from k12_agent_runtime.application.rag.embed_texts import EmbedTextsCommand, EmbedTextsUseCase
from k12_agent_runtime.application.rag.evaluate_retrieval import (
    RetrievalCaseResult,
    RetrievalEvaluationCase,
    RetrievalEvaluationSummary,
    evaluate_retrieval,
    load_retrieval_evaluation_cases,
)
from k12_agent_runtime.application.rag.index_document import (
    IndexDocumentCommand,
    IndexDocumentUseCase,
)
from k12_agent_runtime.application.rag.rerank_documents import (
    RerankDocumentsCommand,
    RerankDocumentsUseCase,
)
from k12_agent_runtime.application.rag.search_knowledge import (
    SearchKnowledgeCommand,
    SearchKnowledgeUseCase,
)

__all__ = [
    "EmbedTextsCommand",
    "EmbedTextsUseCase",
    "IndexDocumentCommand",
    "IndexDocumentUseCase",
    "RetrievalCaseResult",
    "RetrievalEvaluationCase",
    "RetrievalEvaluationSummary",
    "RerankDocumentsCommand",
    "RerankDocumentsUseCase",
    "SearchKnowledgeCommand",
    "SearchKnowledgeUseCase",
    "evaluate_retrieval",
    "load_retrieval_evaluation_cases",
]
