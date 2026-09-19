from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import Field

from k12_agent_runtime.domain.llm import ChatMessage, ChatRequest
from k12_agent_runtime.infrastructure.llm import ChatModelError
from k12_agent_runtime.interfaces.api.dependencies import (
    get_container,
    verify_internal_api_key,
)
from k12_agent_runtime.interfaces.api.schemas.common import ApiModel, ApiResponse

router = APIRouter(
    prefix="/knowledge",
    tags=["knowledge"],
    dependencies=[Depends(verify_internal_api_key)],
)


class CandidatePoint(ApiModel):
    code: str = Field(min_length=1, max_length=128)
    title: str = Field(default="", max_length=256)


class SuggestCoversRequest(ApiModel):
    title: str = Field(default="", max_length=256)
    content: str = Field(default="", max_length=20000)
    candidates: list[CandidatePoint] = Field(default_factory=list, max_length=200)
    limit: int = Field(default=5, ge=1, le=20)


class SuggestCoversResponse(ApiModel):
    codes: list[str]
    reasons: dict[str, str] = Field(default_factory=dict)


@router.post("/suggest-covers", response_model=ApiResponse[SuggestCoversResponse])
async def suggest_covers(
    body: SuggestCoversRequest, request: Request
) -> ApiResponse[SuggestCoversResponse]:
    """从候选知识点目录中选出章节最可能覆盖的编码；不写图，仅建议。"""
    container = get_container(request)
    if container.chat_model is None:
        return ApiResponse.ok(SuggestCoversResponse(codes=[], reasons={}))

    allowed = {item.code: item.title for item in body.candidates if item.code}
    if not allowed:
        return ApiResponse.ok(SuggestCoversResponse(codes=[], reasons={}))

    catalog_lines = "\n".join(
        f"- {code}: {title}" for code, title in list(allowed.items())[:120]
    )
    content = (body.content or "")[:8000]
    prompt = (
        "你是 K12 课程教研助手。根据章节标题与导语，从候选知识点中选出本章覆盖的编码。"
        "只能返回候选列表里已有的 code，不要编造。优先选 1~"
        f"{body.limit} 个最相关的。"
        "输出严格 JSON：{\"codes\":[\"a.b\"],\"reasons\":{\"a.b\":\"一句话原因\"}}。\n\n"
        f"章节标题：{body.title or '(无)'}\n"
        f"章节导语：{content or '(无)'}\n\n"
        f"候选知识点：\n{catalog_lines}"
    )
    try:
        response = await container.chat_model.complete(
            ChatRequest(
                messages=(
                    ChatMessage(role="system", content="只输出合法 JSON，不要 markdown。"),
                    ChatMessage(role="user", content=prompt),
                ),
                json_response=True,
                temperature=0.1,
                max_output_tokens=600,
            )
        )
    except ChatModelError:
        return ApiResponse.ok(SuggestCoversResponse(codes=[], reasons={}))

    parsed = _parse_suggest_json(response.content)
    codes: list[str] = []
    reasons: dict[str, str] = {}
    for code in parsed.get("codes", []):
        if not isinstance(code, str):
            continue
        key = code.strip()
        if key in allowed and key not in codes:
            codes.append(key)
            reason = parsed.get("reasons", {}).get(key)
            reasons[key] = reason if isinstance(reason, str) and reason.strip() else "模型建议"
        if len(codes) >= body.limit:
            break
    return ApiResponse.ok(SuggestCoversResponse(codes=codes, reasons=reasons))


def _parse_suggest_json(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        return {"codes": [], "reasons": {}}
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            return {"codes": [], "reasons": {}}
    return {"codes": [], "reasons": {}}
