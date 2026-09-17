import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from k12_agent_runtime.application.agents.run_agent import (
    AgentContractError,
    AgentExecutionError,
    AgentInputError,
    AgentNotFoundError,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(application: FastAPI) -> None:
    """把内部异常统一转换为 Java 服务可识别的 code/message/data 结构。"""

    @application.exception_handler(AgentNotFoundError)
    async def handle_agent_not_found(
        _request: Request,
        error: AgentNotFoundError,
    ) -> JSONResponse:
        return _error_response(404, str(error))

    @application.exception_handler(AgentInputError)
    async def handle_agent_input(
        _request: Request,
        error: AgentInputError,
    ) -> JSONResponse:
        return _error_response(422, str(error))

    @application.exception_handler(RequestValidationError)
    async def handle_request_validation(
        _request: Request,
        error: RequestValidationError,
    ) -> JSONResponse:
        first_error = error.errors()[0] if error.errors() else None
        message = str(first_error.get("msg")) if first_error else "请求参数校验失败"
        return _error_response(422, message)

    @application.exception_handler(AgentExecutionError)
    @application.exception_handler(AgentContractError)
    async def handle_agent_failure(
        request: Request,
        error: AgentExecutionError | AgentContractError,
    ) -> JSONResponse:
        # 日志保留异常链，响应不返回堆栈和模型厂商的敏感错误内容。
        logger.error(
            "Agent request failed path=%s",
            request.url.path,
            exc_info=(type(error), error, error.__traceback__),
        )
        return _error_response(500, "智能体执行失败")


def _error_response(status_code: int, message: str) -> JSONResponse:
    response = ApiResponse[None].fail(status_code, message)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )
