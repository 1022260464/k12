import secrets
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from k12_agent_runtime.bootstrap.container import ApplicationContainer


def get_container(request: Request) -> ApplicationContainer:
    return request.app.state.container


async def verify_internal_api_key(
    request: Request,
    api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> None:
    container = get_container(request)
    configured_key = container.settings.internal_api_key
    if configured_key is None:
        return

    expected = configured_key.get_secret_value()
    if api_key is None or not secrets.compare_digest(api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )
