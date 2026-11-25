import json
import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.domain.llm.models import ChatMessage, ChatRequest

_ALLOWED_STAGES = {"lower_primary", "upper_primary", "middle_school", "high_school"}
_ALLOWED_SLIDE_TYPES = {"cover", "concept", "example", "quiz", "summary"}
_FENCE_PATTERN = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


class CoursewareSlide(BaseModel):
    type: str
    title: str = ""
    subtitle: str = ""
    bullets: list[str] = Field(default_factory=list)
    body: str = ""
    narration: str = ""
    question: str = ""
    options: list[str] = Field(default_factory=list)
    answer: int = 0
    explanation: str = ""
    points: list[str] = Field(default_factory=list)


class CoursewareDocument(BaseModel):
    title: str
    subtitle: str = ""
    stage: str
    topic_code: str | None = None
    slides: list[CoursewareSlide] = Field(min_length=3, max_length=12)


class GenerateCoursewareUseCase:
    """按学段口吻生成一册课件；协议不合法时让模型重试一次。"""

    def __init__(self, chat_model: ChatModel | None, max_slides: int = 8) -> None:
        self._chat_model = chat_model
        self._max_slides = max_slides

    async def execute(
        self,
        topic: str,
        stage: str = "lower_primary",
        slide_count: int = 6,
        topic_code: str | None = None,
    ) -> dict[str, Any]:
        if self._chat_model is None:
            raise ValueError("大模型尚未配置，暂时不能生成课件")
        normalized_topic = " ".join((topic or "").split())
        if not normalized_topic:
            raise ValueError("请告诉小智课件的主题")
        normalized_stage = stage if stage in _ALLOWED_STAGES else "lower_primary"
        slides = min(max(int(slide_count or 6), 4), self._max_slides)
        messages = self._build_prompt(normalized_topic, normalized_stage, slides)
        last_error: Exception | None = None
        for _ in range(2):
            raw = (
                await self._chat_model.complete(
                    ChatRequest(messages=messages, json_response=True, max_output_tokens=3_000)
                )
            ).content
            try:
                return self._validate(raw, normalized_stage, topic_code)
            except (ValueError, ValidationError) as error:
                last_error = error
        raise ValueError(f"课件生成结果不合法：{last_error}")

    def _build_prompt(self, topic: str, stage: str, slides: int) -> tuple[ChatMessage, ...]:
        if stage == "lower_primary":
            tone = (
                "读者是小学低年级孩子：全部使用儿童口吻，句子不超过15个字，多用比喻和小动物例子，"
                "不要出现英文术语；每页 narration 是读给孩子听的一句话。"
            )
        elif stage in {"middle_school", "high_school"}:
            tone = "读者是中学生：讲解准确严谨，可以出现英文术语并解释含义，每页信息量适中。"
        else:
            tone = "读者是小学高年级学生：讲解生动准确，少量英文术语需给出中文解释。"
        system = (
            "你是K12平台的AI课件设计师。根据主题生成一册互动课件，只输出JSON，不要输出任何解释文字。"
            'JSON结构：{"title": str, "subtitle": str, "slides": ['
            '{"type": "cover", "title": str, "subtitle": str}, '
            '{"type": "concept", "title": str, "bullets": [str], "narration": str}, '
            '{"type": "example", "title": str, "body": str（markdown）}, '
            '{"type": "quiz", "question": str, "options": [str], "answer": int（从0开始）, '
            '"explanation": str}, '
            '{"type": "summary", "title": str, "points": [str]}]}。'
            f"共{slides}页：第1页cover，最后1页summary，中间至少1页quiz、其余用concept/example。"
            f"{tone}"
        )
        return (
            ChatMessage(role="system", content=system),
            ChatMessage(role="user", content=f"课件主题：{topic}"),
        )

    def _validate(self, raw: str, stage: str, topic_code: str | None) -> dict[str, Any]:
        document = CoursewareDocument.model_validate(self._extract_json(raw, stage, topic_code))
        for slide in document.slides:
            if slide.type not in _ALLOWED_SLIDE_TYPES:
                raise ValueError(f"未知页型：{slide.type}")
            if slide.type == "quiz":
                if len(slide.options) < 2:
                    raise ValueError("quiz页至少两个选项")
                if not 0 <= slide.answer < len(slide.options):
                    slide.answer = 0
        if not any(slide.type == "quiz" for slide in document.slides):
            raise ValueError("课件缺少练习页")
        return document.model_dump(exclude_none=True)

    @staticmethod
    def _extract_json(raw: str, stage: str, topic_code: str | None) -> dict[str, Any]:
        text = (raw or "").strip()
        fenced = _FENCE_PATTERN.search(text)
        if fenced:
            text = fenced.group(1)
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("模型没有返回JSON")
        data = json.loads(text[start : end + 1])
        if not isinstance(data, dict):
            raise ValueError("课件JSON结构不正确")
        data["stage"] = stage
        if topic_code and not data.get("topic_code"):
            data["topic_code"] = topic_code
        return data
