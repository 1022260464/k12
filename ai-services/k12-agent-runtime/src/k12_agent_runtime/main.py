import uvicorn

from k12_agent_runtime.core.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "k12_agent_runtime.interfaces.api.app:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
