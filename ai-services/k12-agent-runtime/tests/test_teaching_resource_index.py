import asyncio
from io import BytesIO
from unittest.mock import AsyncMock
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from k12_agent_runtime.application.rag.index_teaching_resource import (
    IndexTeachingResourceCommand,
    IndexTeachingResourceUseCase,
)
from k12_agent_runtime.application.rag.teaching_resource_text import (
    extract_document,
    extract_text,
)
from k12_agent_runtime.core.config import Settings
from k12_agent_runtime.domain.rag import IndexedDocument
from k12_agent_runtime.interfaces.api.app import create_app


def _office_file(name: str, xml: str) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.writestr(name, xml)
    return output.getvalue()


def test_extract_docx_paragraphs() -> None:
    content = _office_file(
        "word/document.xml",
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:p><w:r><w:t>人工智能</w:t></w:r><w:r><w:t>课程</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>机器学习</w:t></w:r></w:p></w:document>",
    )
    assert extract_text(content, "docx") == "人工智能课程\n机器学习"


def test_extract_pptx_slide_text() -> None:
    content = _office_file(
        "ppt/slides/slide1.xml",
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        "<a:p><a:r><a:t>算法步骤</a:t></a:r></a:p></p:sld>",
    )
    assert extract_text(content, "pptx") == "算法步骤"


def test_extract_pptx_preserves_slide_location_and_diagnostics() -> None:
    content = _office_file(
        "ppt/slides/slide1.xml",
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        "<a:p><a:r><a:t>训练集与测试集</a:t></a:r></a:p>"
        "<a:p><a:r><a:t>测试集用于检查模型是否能处理新数据。</a:t></a:r></a:p></p:sld>",
    )

    extracted = extract_document(content, "pptx")

    assert extracted.sections[0].slide_number == 1
    assert extracted.sections[0].heading == "训练集与测试集"
    assert extracted.diagnostics["slideCount"] == 1
    assert extracted.diagnostics["sourceFormat"] == "pptx"


def test_reject_empty_office_text() -> None:
    content = _office_file("word/document.xml", "<document/>")
    with pytest.raises(ValueError, match="未提取到文本"):
        extract_text(content, "docx")


def test_index_uses_stable_document_id_and_stage() -> None:
    storage = AsyncMock()
    storage.read_bytes.return_value = _office_file(
        "word/document.xml",
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:p><w:t>向量检索</w:t></w:p></w:document>",
    )
    index_document = AsyncMock()
    index_document.execute.return_value = IndexedDocument(
        document_id="teaching-resource-7", chunk_count=1, embedding_model="bge-m3"
    )
    use_case = IndexTeachingResourceUseCase(storage, index_document, "materials")
    command = IndexTeachingResourceCommand(
        resource_id=7,
        title="检索教材",
        object_key="teaching-resources/12345678-1234-1234-1234-123456789abc.docx",
        stage_code="JUNIOR_HIGH",
        subject="人工智能",
        source_note="原创",
        course_id=9,
        chapter_id=12,
        chapter="数据集划分",
        grade="八年级",
        textbook="AI 通识",
        knowledge_code="machine_learning.datasets",
    )

    result = asyncio.run(use_case.execute(command))

    document = index_document.execute.call_args.args[0].document
    assert result.document_id == "teaching-resource-7"
    assert document.document_id == "teaching-resource-7"
    assert document.stage_code == "middle_school"
    assert document.grade == "八年级"
    assert document.textbook == "AI 通识"
    assert document.chapter == "数据集划分"
    assert document.metadata["courseId"] == 9
    assert document.metadata["chapterId"] == 12
    assert document.metadata["knowledgeCode"] == "machine_learning.datasets"
    assert document.source_uri == f"s3://materials/{command.object_key}"
    assert document.content == "向量检索"
    assert document.sections[0].paragraph_number == 1
    assert document.metadata["extraction"]["sourceFormat"] == "docx"


def test_reject_unapproved_object_key_without_reading() -> None:
    storage = AsyncMock()
    use_case = IndexTeachingResourceUseCase(storage, AsyncMock(), "materials")
    command = IndexTeachingResourceCommand(
        7, "标题", "private/draft.docx", "JUNIOR_HIGH", "AI", "原创"
    )

    with pytest.raises(ValueError, match="对象键不合法"):
        asyncio.run(use_case.execute(command))
    storage.read_bytes.assert_not_awaited()


@pytest.mark.parametrize(
    ("business_stage", "rag_stage"),
    [
        ("LOW_PRIMARY", "lower_primary"),
        ("HIGH_PRIMARY", "upper_primary"),
        ("JUNIOR_HIGH", "middle_school"),
        ("SENIOR_HIGH", "high_school"),
    ],
)
def test_business_stage_matches_rag_search_stage(business_stage: str, rag_stage: str) -> None:
    storage = AsyncMock()
    storage.read_bytes.return_value = _office_file(
        "word/document.xml",
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:p><w:t>知识点</w:t></w:p></w:document>",
    )
    index_document = AsyncMock()
    index_document.execute.return_value = IndexedDocument("teaching-resource-7", 1, "bge-m3")
    use_case = IndexTeachingResourceUseCase(storage, index_document, "materials")
    command = IndexTeachingResourceCommand(
        7, "标题", "teaching-resources/12345678-1234-1234-1234-123456789abc.docx",
        business_stage, "AI", "原创",
    )

    asyncio.run(use_case.execute(command))

    assert index_document.execute.call_args.args[0].document.stage_code == rag_stage


def test_internal_index_route_checks_key_and_returns_camel_case() -> None:
    settings = Settings(_env_file=None, internal_api_key=SecretStr("shared-test-key"))
    with TestClient(create_app(settings)) as client:
        fake_index = AsyncMock()
        fake_index.execute.return_value = IndexedDocument("teaching-resource-7", 2, "bge-m3")
        object.__setattr__(client.app.state.container, "index_teaching_resource", fake_index)
        payload = {
            "resourceId": 7,
            "title": "检索教材",
            "objectKey": "teaching-resources/12345678-1234-1234-1234-123456789abc.docx",
            "stageCode": "JUNIOR_HIGH",
            "subject": "AI",
            "sourceNote": "原创",
            "courseId": 9,
            "chapterId": 12,
            "chapter": "数据集划分",
            "grade": "八年级",
            "textbook": "AI 通识",
            "knowledgeCode": "machine_learning.datasets",
        }
        path = "/internal/v1/rag/teaching-resources/index"
        assert client.post(path, json=payload).status_code == 401
        response = client.post(
            path, json=payload, headers={"X-Internal-Api-Key": "shared-test-key"}
        )

    assert response.status_code == 200
    assert response.json()["data"] == {
        "documentId": "teaching-resource-7", "chunkCount": 2, "embeddingModel": "bge-m3"
    }
    assert fake_index.execute.call_args.args[0].course_id == 9
    assert fake_index.execute.call_args.args[0].knowledge_code == "machine_learning.datasets"


def test_internal_delete_route_uses_stable_document_id() -> None:
    settings = Settings(_env_file=None, internal_api_key=SecretStr("shared-test-key"))
    with TestClient(create_app(settings)) as client:
        repository = AsyncMock()
        repository.delete_document.return_value = True
        object.__setattr__(client.app.state.container, "knowledge_repository", repository)
        response = client.delete(
            "/internal/v1/rag/teaching-resources/7/index",
            headers={"X-Internal-Api-Key": "shared-test-key"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is True
    repository.delete_document.assert_awaited_once_with("teaching-resource-7")
