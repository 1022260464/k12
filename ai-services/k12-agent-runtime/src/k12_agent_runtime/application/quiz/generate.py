import json
import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from k12_agent_runtime.domain.llm import ChatModel
from k12_agent_runtime.domain.llm.models import ChatMessage, ChatRequest

_ALLOWED_STAGES = {"lower_primary", "upper_primary", "middle_school", "high_school"}
_FENCE_PATTERN = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)

# 学段画像：认知层次 / 语言难度 / 情境与干扰项都要真正拉开差距，不只是口吻。
_STAGE_PROFILES = {
    "lower_primary": (
        "做题的是小学低年级孩子（6-8岁，一二年级）。",
        "只考最基础的「认一认、选一选」：生活中的常见现象、对错与好坏习惯的判断，"
        "不考术语和定义，答案应该是一眼能看懂的生活常识。",
        "题干不超过 25 个字，用儿童口吻，像绘本里的话；每个选项不超过 12 个字，"
        "贴近孩子的生活（家里、教室、小动物、玩具）。",
        "错误选项要明显不合理，孩子能一眼排除；explanation 用鼓励的语气讲一句为什么。",
    ),
    "upper_primary": (
        "做题的是小学高年级学生（9-12岁，三到六年级）。",
        "考简单理解和运用：举例子、判断做法是否合适、把知识和生活场景对上号；"
        "可以出现课标里的简单概念，但不能只考死记硬背。",
        "题干不超过 40 字，生动具体（校园活动、家庭上网、小组合作等情境）；"
        "选项 15 字左右，用小学生能懂的词。",
        "错误选项要似是而非、仔细想才能分辨；explanation 一两句话点出关键理由。",
    ),
    "middle_school": (
        "做题的是初中生（12-15岁）。",
        "考概念辨析与情境分析：理解原理、比较异同、按步骤推理，能回答「为什么/区别是什么」；"
        "由易到难里至少一半的题要是理解或分析层次，不能全是记忆题。",
        "题目严谨准确，可使用学科术语；选项 20 字左右，表述完整、平行。",
        "干扰项要有迷惑性：对应常见误读、似是而非的说法或漏了关键步骤的答案；"
        "explanation 讲清判断依据，必要时说明错误选项错在哪。",
    ),
    "high_school": (
        "做题的是高中生（15-18岁）。",
        "考综合应用与评价：多步推理、方案比较与权衡、结合真实技术或社会议题做分析判断；"
        "大部分题目要落在应用、分析及以上认知层次。",
        "题目要有思维深度，情境可以更复杂（项目决策、伦理权衡、系统设计）；"
        "选项表述有区分度，长度可以较长。",
        "干扰项要对应真实的认知误区（如忽略约束条件、混淆相关与因果）；"
        "explanation 给出简要分析思路或判断标准。",
    ),
}


class QuizQuestion(BaseModel):
    stem: str
    options: list[str] = Field(min_length=2, max_length=6)
    answer: int = 0
    explanation: str = ""


class QuizDocument(BaseModel):
    title: str = ""
    questions: list[QuizQuestion] = Field(min_length=1, max_length=10)


class GenerateQuizUseCase:
    """按学段画像出一组随堂练习题：认知层次、语言难度、口吻都随学段变化；学生端直接可练，不依赖教师发布。"""

    def __init__(self, chat_model: ChatModel | None, max_questions: int = 8) -> None:
        self._chat_model = chat_model
        self._max_questions = max_questions

    async def execute(
        self,
        topic: str,
        stage: str = "lower_primary",
        count: int = 5,
        source_text: str | None = None,
    ) -> dict[str, Any]:
        if self._chat_model is None:
            raise ValueError("大模型尚未配置，暂时不能出题")
        normalized_topic = " ".join((topic or "").split())
        if not normalized_topic:
            raise ValueError("请告诉小智要练习的主题")
        normalized_stage = stage if stage in _ALLOWED_STAGES else "lower_primary"
        count = min(max(int(count or 5), 3), self._max_questions)
        excerpt = " ".join((source_text or "").split())[:2000]
        messages = self._build_prompt(normalized_topic, normalized_stage, count, excerpt)
        last_error: Exception | None = None
        for _ in range(2):
            raw = (
                await self._chat_model.complete(
                    ChatRequest(messages=messages, json_response=True, max_output_tokens=2_500)
                )
            ).content
            try:
                return self._validate(raw)
            except (ValueError, ValidationError) as error:
                last_error = error
        raise ValueError(f"出题结果不合法：{last_error}")

    def _build_prompt(self, topic: str, stage: str, count: int, excerpt: str) -> tuple[ChatMessage, ...]:
        learner, cognitive, language, distractor = _STAGE_PROFILES.get(stage, _STAGE_PROFILES["lower_primary"])
        system = (
            "你是K12平台的AI出题老师。根据主题和可选的课文内容出一组选择题，只输出JSON，不要输出任何解释文字。"
            'JSON结构：{"title": str, "questions": [{"stem": str, "options": [str, str, str, str], '
            '"answer": int（正确选项下标，从0开始）, "explanation": str}]}。'
            f"出{count}道题；题目之间不重复，由易到难；每题4个选项，只有1个正确答案。\n"
            f"{learner}\n考什么：{cognitive}\n语言要求：{language}\n选项与解析：{distractor}"
        )
        user = f"练习主题：{topic}"
        if excerpt:
            user = f"{user}\n课文内容（优先围绕它出题）：{excerpt}"
        return (
            ChatMessage(role="system", content=system),
            ChatMessage(role="user", content=user),
        )

    def _validate(self, raw: str) -> dict[str, Any]:
        document = QuizDocument.model_validate(self._extract_json(raw))
        for question in document.questions:
            if not 0 <= question.answer < len(question.options):
                question.answer = 0
            if len("".join(question.options).strip()) < 1:
                raise ValueError("选项内容为空")
        return document.model_dump(exclude_none=True)

    @staticmethod
    def _extract_json(raw: str) -> dict[str, Any]:
        text = (raw or "").strip()
        fenced = _FENCE_PATTERN.search(text)
        if fenced:
            text = fenced.group(1)
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("模型没有返回JSON")
        data = json.loads(text[start : end + 1])
        if not isinstance(data, dict):
            raise ValueError("出题JSON结构不正确")
        return data
