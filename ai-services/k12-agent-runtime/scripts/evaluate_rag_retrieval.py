"""使用人工标注问题集评估真实BGE、Reranker和pgvector检索链路。"""

import argparse
import asyncio
from pathlib import Path

from k12_agent_runtime.application.rag import (
    evaluate_retrieval,
    load_retrieval_evaluation_cases,
)
from k12_agent_runtime.bootstrap.container import build_container
from k12_agent_runtime.core.config import Settings

DEFAULT_DATA_FILE = (
    Path(__file__).resolve().parents[1] / "data" / "rag_retrieval_evaluation.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="评估K12知识库检索质量")
    parser.add_argument("--data-file", type=Path, default=DEFAULT_DATA_FILE)
    parser.add_argument("--candidate-count", type=int, default=None)
    parser.add_argument("--top-k", type=int, default=None)
    parser.add_argument(
        "--min-hit-rate",
        type=float,
        default=None,
        help="可选的Hit@K最低门槛；低于门槛时进程返回1",
    )
    return parser.parse_args()


async def run(args: argparse.Namespace) -> int:
    settings = Settings()
    if not settings.rag_enabled or settings.rag_database_url is None:
        raise RuntimeError("请先启用RAG并配置K12_AGENT_RAG_DATABASE_URL")

    cases = load_retrieval_evaluation_cases(args.data_file.resolve())
    candidate_count = args.candidate_count or settings.rag_candidate_count
    top_k = args.top_k or settings.rag_top_k
    if candidate_count < 1 or top_k < 1:
        raise ValueError("candidate-count和top-k必须大于0")

    container = build_container(settings)
    try:
        summary = await evaluate_retrieval(
            container.search_knowledge,
            cases,
            candidate_count=candidate_count,
            top_k=top_k,
        )
    finally:
        await container.close()

    print(f"cases={summary.total_cases}")
    print(f"passed={summary.passed_cases}")
    print(f"hit_at_{top_k}={summary.hit_rate_at_k:.3f}")
    print(f"mrr={summary.mean_reciprocal_rank:.3f}")
    print(f"no_result_accuracy={summary.no_result_accuracy:.3f}")
    print(f"average_duration_ms={summary.average_duration_ms:.1f}")
    print(f"max_duration_ms={summary.max_duration_ms}")
    for result in summary.results:
        status = "PASS" if result.passed else "FAIL"
        documents = ",".join(result.retrieved_document_ids) or "<empty>"
        print(
            f"{status} case={result.case_id} rank={result.first_relevant_rank} "
            f"duration_ms={result.duration_ms} documents={documents}"
        )

    if args.min_hit_rate is not None and summary.hit_rate_at_k < args.min_hit_rate:
        return 1
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run(parse_args())))


if __name__ == "__main__":
    main()
