"""验证MongoDB、MinIO和Redis的真实读写链路。"""

import asyncio
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from k12_agent_runtime.application.agents.run_agent import RunAgentCommand
from k12_agent_runtime.application.storage import StoreObjectCommand
from k12_agent_runtime.bootstrap.container import build_container
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.rag import KnowledgeSearchResult

DEMO_FILE = Path(__file__).resolve().parents[1] / "data" / "demo_knowledge.json"


async def main() -> None:
    settings = Settings()
    container = build_container(settings)
    try:
        run_id = f"storage-smoke-{uuid4()}"
        result = await container.run_agent.execute(
            RunAgentCommand(
                run_id=run_id,
                agent_code="demo-chart",
                input_text="生成演示学习时长图表",
                user_id="smoke-test",
                context={"source": "smoke-script"},
            )
        )
        print(f"mongodb trace: run_id={result.run_id}, status={result.status.value}")

        with DEMO_FILE.open("rb") as stream:
            stored = await container.store_object.execute(
                StoreObjectCommand(
                    filename=DEMO_FILE.name,
                    content_type="application/json",
                    size_bytes=DEMO_FILE.stat().st_size,
                    stream=stream,
                    folder="demo",
                )
            )
        download_url = await container.create_download_url.execute(stored.object_key)
        parsed_url = urlsplit(download_url)
        print(
            f"minio object: uri={stored.uri}, "
            f"download_endpoint={parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
        )

        if container.rag_cache is None:
            raise RuntimeError("Redis RAG cache is disabled")
        cache_key = f"smoke-{uuid4()}"
        cache_value = KnowledgeSearchResult(
            query="Redis缓存测试",
            embedding_model="smoke",
            candidate_count=0,
            documents=(),
        )
        await container.rag_cache.set(cache_key, cache_value, ttl_seconds=60)
        cached = await container.rag_cache.get(cache_key)
        if cached != cache_value:
            raise RuntimeError("Redis cache round trip failed")
        print("redis cache: write=ok, read=ok, ttl=60s")
    finally:
        await container.close()


if __name__ == "__main__":
    asyncio.run(main())
