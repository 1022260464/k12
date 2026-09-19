"""已发布教学资料的人工入库用例。"""

import re
from dataclasses import dataclass

from k12_agent_runtime.application.rag.index_document import (
    IndexDocumentCommand,
    IndexDocumentUseCase,
)
from k12_agent_runtime.application.rag.teaching_resource_text import (
    MAX_INDEX_BYTES,
    extract_text,
)
from k12_agent_runtime.domain.rag import IndexedDocument, KnowledgeDocument
from k12_agent_runtime.domain.storage import ObjectStorage

_OBJECT_KEY = re.compile(r"^teaching-resources/[0-9a-f-]{36}\.(pdf|docx|pptx)$")
_KNOWLEDGE_CODE = re.compile(r"^[a-z][a-z0-9_.-]{2,63}$")
_RAG_STAGES = {
    "LOW_PRIMARY": "lower_primary",
    "HIGH_PRIMARY": "upper_primary",
    "JUNIOR_HIGH": "middle_school",
    "SENIOR_HIGH": "high_school",
}


@dataclass(frozen=True, slots=True)
class IndexTeachingResourceCommand:
    resource_id: int
    title: str
    object_key: str
    stage_code: str
    subject: str
    source_note: str
    course_id: int | None = None
    chapter_id: int | None = None
    chapter: str | None = None
    grade: str | None = None
    textbook: str | None = None
    knowledge_code: str | None = None
    description: str | None = None


class IndexTeachingResourceUseCase:
    def __init__(
        self,
        storage: ObjectStorage | None,
        index_document: IndexDocumentUseCase,
        bucket: str,
    ) -> None:
        self._storage = storage
        self._index_document = index_document
        self._bucket = bucket

    async def execute(self, command: IndexTeachingResourceCommand) -> IndexedDocument:
        if self._storage is None:
            raise RuntimeError("MinIO 对象存储尚未启用")
        match = _OBJECT_KEY.fullmatch(command.object_key)
        if command.resource_id < 1 or match is None:
            raise ValueError("资料标识或对象键不合法")
        stage_code = _RAG_STAGES.get(command.stage_code)
        if stage_code is None:
            raise ValueError("资料学段不合法")
        if command.chapter_id is not None and command.course_id is None:
            raise ValueError("章节缺少关联课程")
        if command.knowledge_code and not _KNOWLEDGE_CODE.fullmatch(command.knowledge_code):
            raise ValueError("知识点编码格式不合法")
        content = await self._storage.read_bytes(command.object_key, MAX_INDEX_BYTES)
        text = extract_text(content, match.group(1))
        description = (command.description or "").strip()
        if description:
            text = f"【资料简介】{description}\n\n{text}"
        document = KnowledgeDocument(
            document_id=f"teaching-resource-{command.resource_id}",
            title=command.title,
            content=text,
            source_type="teaching_resource",
            source_uri=f"s3://{self._bucket}/{command.object_key}",
            stage_code=stage_code,
            grade=command.grade,
            textbook=command.textbook,
            chapter=command.chapter,
            metadata={
                "resourceId": command.resource_id,
                "subject": command.subject,
                "sourceNote": command.source_note,
                **({"courseId": command.course_id} if command.course_id else {}),
                **({"chapterId": command.chapter_id} if command.chapter_id else {}),
                **({"knowledgeCode": command.knowledge_code} if command.knowledge_code else {}),
                **({"description": description} if description else {}),
            },
        )
        return await self._index_document.execute(IndexDocumentCommand(document=document))
