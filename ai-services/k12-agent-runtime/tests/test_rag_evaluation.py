import asyncio
import json
from pathlib import Path

import pytest

from k12_agent_runtime.application.rag import (
    RetrievalEvaluationCase,
    evaluate_retrieval,
    load_retrieval_evaluation_cases,
)
from k12_agent_runtime.domain.rag import KnowledgeSearchResult, RankedDocument


class FakeKnowledgeSearch:
    async def execute(self, command):
        documents_by_query = {
            "命中第二位": (
                RankedDocument("wrong", "无关", 0.9),
                RankedDocument("expected", "相关", 0.8),
            ),
            "没有结果": (),
        }
        documents = documents_by_query[command.query]
        return KnowledgeSearchResult(
            query=command.query,
            embedding_model="test",
            candidate_count=len(documents),
            documents=documents,
        )


def test_load_evaluation_cases_rejects_duplicate_ids(tmp_path: Path) -> None:
    path = tmp_path / "cases.json"
    path.write_text(
        json.dumps(
            [
                {"caseId": "same", "query": "q1", "expectedDocumentIds": ["d1"]},
                {"caseId": "same", "query": "q2", "expectedDocumentIds": ["d2"]},
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="caseId重复"):
        load_retrieval_evaluation_cases(path)


def test_evaluate_retrieval_calculates_hit_mrr_and_empty_result() -> None:
    cases = (
        RetrievalEvaluationCase(
            case_id="rank-two",
            query="命中第二位",
            expected_document_ids=("expected",),
        ),
        RetrievalEvaluationCase(
            case_id="empty",
            query="没有结果",
            expected_document_ids=(),
            expect_no_results=True,
        ),
    )

    summary = asyncio.run(
        evaluate_retrieval(
            FakeKnowledgeSearch(),  # type: ignore[arg-type]
            cases,
            candidate_count=10,
            top_k=3,
        )
    )

    assert summary.total_cases == 2
    assert summary.passed_cases == 2
    assert summary.hit_rate_at_k == 1
    assert summary.mean_reciprocal_rank == 0.5
    assert summary.no_result_accuracy == 1
    assert summary.results[0].first_relevant_rank == 2
    assert summary.results[1].retrieved_document_ids == ()
