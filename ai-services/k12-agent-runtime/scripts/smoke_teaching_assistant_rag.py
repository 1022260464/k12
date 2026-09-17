"""使用本地.env验证Teaching Assistant、RAG和千问的真实组合链路。"""

import asyncio
from uuid import uuid4

from k12_agent_runtime.application.agents import RunAgentCommand
from k12_agent_runtime.bootstrap.container import build_container
from k12_agent_runtime.core.config import Settings


async def main() -> None:
    settings = Settings()
    if not settings.rag_enabled or settings.rag_database_url is None:
        raise RuntimeError("请先启用RAG并配置K12_AGENT_RAG_DATABASE_URL")

    container = build_container(settings)
    try:
        result = await container.run_agent.execute(
            RunAgentCommand(
                run_id=f"teaching-rag-smoke-{uuid4()}",
                agent_code="teaching-assistant",
                input_text="为什么冒泡排序完成一轮后，最大的数字会移动到最后？",
                user_id="smoke-student",
                context={
                    "stage": "初中",
                    "grade": "初中二年级",
                    "textbook": "K12人工智能通识演示教材",
                    "chapter": "排序算法",
                    "topic": "冒泡排序",
                },
            )
        )
        references = result.metadata.get("knowledgeReferences", [])
        print(f"run_id={result.run_id}")
        print(f"status={result.status.value}")
        print(f"model_used={result.metadata.get('modelUsed')}")
        print(f"rag_retrieved={result.metadata.get('ragRetrieved')}")
        print(f"rag_used={result.metadata.get('ragUsed')}")
        print(f"reference_count={len(references)}")
        for reference in references:
            print(
                "reference="
                f"{reference.get('documentId')}|{reference.get('title')}|"
                f"{reference.get('chapter')}"
            )
    finally:
        await container.close()


if __name__ == "__main__":
    asyncio.run(main())
