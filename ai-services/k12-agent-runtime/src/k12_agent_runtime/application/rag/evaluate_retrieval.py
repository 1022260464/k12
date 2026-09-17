import json
from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any

from k12_agent_runtime.application.rag.search_knowledge import (
    SearchKnowledgeCommand,
    SearchKnowledgeUseCase,
)


@dataclass(frozen=True, slots=True)
class RetrievalEvaluationCase:
    """一条人工标注的检索问题，期望文档ID至少命中一个即可。"""

    case_id: str
    query: str
    expected_document_ids: tuple[str, ...]
    expect_no_results: bool = False
    stage_code: str | None = None
    grade: str | None = None
    textbook: str | None = None


@dataclass(frozen=True, slots=True)
class RetrievalCaseResult:
    case_id: str
    passed: bool
    first_relevant_rank: int | None
    retrieved_document_ids: tuple[str, ...]
    duration_ms: int


@dataclass(frozen=True, slots=True)
class RetrievalEvaluationSummary:
    total_cases: int
    passed_cases: int
    relevant_cases: int
    no_result_cases: int
    hit_rate_at_k: float
    mean_reciprocal_rank: float
    no_result_accuracy: float
    average_duration_ms: float
    max_duration_ms: int
    results: tuple[RetrievalCaseResult, ...]


def load_retrieval_evaluation_cases(path: Path) -> tuple[RetrievalEvaluationCase, ...]:
    """加载并严格校验评测集，防止错误样例产生虚假的质量分数。"""
    raw_cases: Any = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw_cases, list) or not raw_cases:
        raise ValueError("RAG评测集必须是非空JSON数组")

    cases: list[RetrievalEvaluationCase] = []
    case_ids: set[str] = set()
    for index, item in enumerate(raw_cases, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"第{index}条RAG评测样例必须是JSON对象")
        case_id = _required_text(item, "caseId", index)
        query = _required_text(item, "query", index)
        if case_id in case_ids:
            raise ValueError(f"RAG评测caseId重复：{case_id}")
        case_ids.add(case_id)

        expect_no_results = item.get("expectNoResults", False)
        if not isinstance(expect_no_results, bool):
            raise ValueError(f"第{index}条expectNoResults必须是布尔值")
        expected_ids = _text_tuple(item.get("expectedDocumentIds", []), index)
        if expect_no_results and expected_ids:
            raise ValueError(f"第{index}条空结果样例不能配置expectedDocumentIds")
        if not expect_no_results and not expected_ids:
            raise ValueError(f"第{index}条命中样例必须配置expectedDocumentIds")

        cases.append(
            RetrievalEvaluationCase(
                case_id=case_id,
                query=query,
                expected_document_ids=expected_ids,
                expect_no_results=expect_no_results,
                stage_code=_optional_text(item.get("stageCode")),
                grade=_optional_text(item.get("grade")),
                textbook=_optional_text(item.get("textbook")),
            )
        )
    return tuple(cases)


async def evaluate_retrieval(
    search_knowledge: SearchKnowledgeUseCase,
    cases: tuple[RetrievalEvaluationCase, ...],
    *,
    candidate_count: int,
    top_k: int,
) -> RetrievalEvaluationSummary:
    """逐条执行真实检索，计算Hit@K、MRR、空结果准确率与耗时。"""
    results: list[RetrievalCaseResult] = []
    reciprocal_rank_sum = 0.0
    relevant_hits = 0
    no_result_hits = 0

    for case in cases:
        started = perf_counter()
        search_result = await search_knowledge.execute(
            SearchKnowledgeCommand(
                query=case.query,
                candidate_count=candidate_count,
                top_k=top_k,
                stage_code=case.stage_code,
                grade=case.grade,
                textbook=case.textbook,
            )
        )
        duration_ms = round((perf_counter() - started) * 1000)
        retrieved_ids = tuple(item.document_id for item in search_result.documents)

        if case.expect_no_results:
            passed = not retrieved_ids
            first_rank = None
            no_result_hits += int(passed)
        else:
            first_rank = _first_relevant_rank(retrieved_ids, case.expected_document_ids)
            passed = first_rank is not None
            relevant_hits += int(passed)
            if first_rank is not None:
                reciprocal_rank_sum += 1 / first_rank

        results.append(
            RetrievalCaseResult(
                case_id=case.case_id,
                passed=passed,
                first_relevant_rank=first_rank,
                retrieved_document_ids=retrieved_ids,
                duration_ms=duration_ms,
            )
        )

    relevant_count = sum(not case.expect_no_results for case in cases)
    no_result_count = len(cases) - relevant_count
    durations = [result.duration_ms for result in results]
    return RetrievalEvaluationSummary(
        total_cases=len(cases),
        passed_cases=sum(result.passed for result in results),
        relevant_cases=relevant_count,
        no_result_cases=no_result_count,
        hit_rate_at_k=relevant_hits / relevant_count if relevant_count else 1.0,
        mean_reciprocal_rank=reciprocal_rank_sum / relevant_count if relevant_count else 1.0,
        no_result_accuracy=no_result_hits / no_result_count if no_result_count else 1.0,
        average_duration_ms=sum(durations) / len(durations),
        max_duration_ms=max(durations),
        results=tuple(results),
    )


def _first_relevant_rank(
    retrieved_ids: tuple[str, ...],
    expected_ids: tuple[str, ...],
) -> int | None:
    expected = set(expected_ids)
    return next(
        (
            index
            for index, document_id in enumerate(retrieved_ids, start=1)
            if document_id in expected
        ),
        None,
    )


def _required_text(item: dict[str, Any], key: str, index: int) -> str:
    value = _optional_text(item.get(key))
    if value is None:
        raise ValueError(f"第{index}条{key}不能为空")
    return value


def _optional_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _text_tuple(value: Any, index: int) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise ValueError(f"第{index}条expectedDocumentIds必须是数组")
    values = tuple(item.strip() for item in value if isinstance(item, str) and item.strip())
    if len(values) != len(value):
        raise ValueError(f"第{index}条expectedDocumentIds只能包含非空字符串")
    return values
