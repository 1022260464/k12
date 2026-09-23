from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from k12_agent_runtime.bootstrap.container import build_container
from k12_agent_runtime.core.config import Settings, get_settings
from k12_agent_runtime.core.logging import configure_logging
from k12_agent_runtime.interfaces.api.errors import register_exception_handlers
from k12_agent_runtime.interfaces.api.routes import (
    agents,
    health,
    knowledge,
    rag,
    sandbox,
    speech,
    storage,
)


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        configure_logging(runtime_settings.log_level)
        container = build_container(runtime_settings)
        application.state.container = container
        try:
            yield
        finally:
            await container.close()

    application = FastAPI(
        title="K12 Agent Runtime",
        version="0.1.0",
        description="Internal runtime for K12 agents, tools, and sandbox jobs.",
        lifespan=lifespan,
    )
    register_exception_handlers(application)
    application.include_router(health.router, prefix="/internal/v1")
    application.include_router(agents.router, prefix="/internal/v1")
    application.include_router(sandbox.router, prefix="/internal/v1")
    application.include_router(rag.router, prefix="/internal/v1")
    application.include_router(knowledge.router, prefix="/internal/v1")
    application.include_router(storage.router, prefix="/internal/v1")
    application.include_router(speech.router, prefix="/internal/v1")
    return application


app = create_app()
