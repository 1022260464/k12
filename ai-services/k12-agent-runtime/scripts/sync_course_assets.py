"""将前端课程插画同步到MinIO中的稳定对象键。"""

import asyncio
from pathlib import Path

from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.infrastructure.storage import MinioObjectStorage

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
ASSET_DIRECTORY = REPOSITORY_ROOT / "qianduan" / "user-app" / "public" / "assets"
COURSE_ASSETS = (
    "k12-ai-learning-journey.png",
    "course-code-comic.png",
    "course-math-comic.png",
    "course-science-comic.png",
    "course-reading-comic.png",
)


async def main() -> None:
    settings = Settings()
    if not settings.minio_enabled:
        raise RuntimeError("请先在.env中设置 K12_AGENT_MINIO_ENABLED=true")
    if settings.minio_access_key is None or settings.minio_secret_key is None:
        raise RuntimeError("请先在.env中填写MinIO访问密钥")

    storage = MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key.get_secret_value(),
        secret_key=settings.minio_secret_key.get_secret_value(),
        bucket=settings.minio_bucket,
        secure=settings.minio_secure,
        region=settings.minio_region,
        connect_timeout_seconds=settings.minio_connect_timeout_seconds,
    )

    uploaded = 0
    for filename in COURSE_ASSETS:
        source = ASSET_DIRECTORY / filename
        if not source.is_file():
            raise FileNotFoundError(f"课程素材不存在: {source}")
        object_key = f"course-assets/v1/{filename}"
        with source.open("rb") as stream:
            stored = await storage.put(
                object_key=object_key,
                stream=stream,
                size_bytes=source.stat().st_size,
                content_type="image/png",
            )
        uploaded += 1
        print(f"已同步: {stored.object_key} ({stored.size_bytes} bytes)")

    print(f"课程素材同步完成: bucket={settings.minio_bucket}, count={uploaded}")


if __name__ == "__main__":
    asyncio.run(main())
