"""从审核通过的资料中提取文本，并保留页码、幻灯片和标题等来源信息。"""

import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader

from k12_agent_runtime.domain.rag import DocumentSection

MAX_INDEX_BYTES = 20 * 1024 * 1024
MAX_XML_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 200_000
MAX_PDF_PAGES = 100

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


@dataclass(frozen=True, slots=True)
class ExtractedDocument:
    text: str
    sections: tuple[DocumentSection, ...]
    diagnostics: dict[str, Any]


def extract_document(content: bytes, extension: str) -> ExtractedDocument:
    if not content or len(content) > MAX_INDEX_BYTES:
        raise ValueError("资料为空或超过 20 MB 入库上限")
    try:
        if extension == "pdf":
            sections, diagnostics = _pdf_sections(content)
        elif extension == "docx":
            sections, diagnostics = _docx_sections(content)
        elif extension == "pptx":
            sections, diagnostics = _pptx_sections(content)
        else:
            raise ValueError("当前只支持 PDF、DOCX、PPTX 文本入库")
    except (BadZipFile, ElementTree.ParseError, OSError, KeyError) as error:
        raise ValueError("资料文件损坏或格式不正确") from error

    text = "\n".join(section.text.strip() for section in sections if section.text.strip())
    if not text:
        raise ValueError("未提取到文本；扫描版 PDF 需要先进行 OCR")
    if len(text) > MAX_TEXT_CHARS:
        raise ValueError("提取文本超过 20 万字符，请拆分资料后入库")
    return ExtractedDocument(
        text=text,
        sections=tuple(section for section in sections if section.text.strip()),
        diagnostics={**diagnostics, "characterCount": len(text)},
    )


def extract_text(content: bytes, extension: str) -> str:
    """兼容旧调用方；新入库流程应使用 extract_document。"""

    return extract_document(content, extension).text


def _pdf_sections(content: bytes) -> tuple[list[DocumentSection], dict[str, Any]]:
    try:
        reader = PdfReader(BytesIO(content), strict=False)
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError("PDF 超过 100 页，请拆分后入库")
        sections: list[DocumentSection] = []
        low_text_pages = 0
        for page_number, page in enumerate(reader.pages, start=1):
            text = _normalize_lines(page.extract_text() or "")
            if len(text) < 30:
                low_text_pages += 1
            if text:
                sections.append(DocumentSection(
                    text=text,
                    heading=_guess_heading(text),
                    page_number=page_number,
                ))
        page_count = len(reader.pages)
        return sections, {
            "parser": "pypdf",
            "sourceFormat": "pdf",
            "pageCount": page_count,
            "lowTextPageCount": low_text_pages,
            "ocrRecommended": page_count > 0 and low_text_pages / page_count >= 0.3,
        }
    except ValueError:
        raise
    except Exception as error:  # noqa: BLE001
        raise ValueError("PDF 无法解析") from error


def _docx_sections(content: bytes) -> tuple[list[DocumentSection], dict[str, Any]]:
    with ZipFile(BytesIO(content)) as archive:
        root = ElementTree.fromstring(_read_xml(archive, "word/document.xml"))
        sections: list[DocumentSection] = []
        current_heading: str | None = None
        paragraph_number = 0
        for paragraph in root.iter(f"{_W}p"):
            text = "".join(node.text or "" for node in paragraph.iter(f"{_W}t")).strip()
            if not text:
                continue
            paragraph_number += 1
            style_node = paragraph.find(f"./{_W}pPr/{_W}pStyle")
            style = style_node.get(f"{_W}val", "") if style_node is not None else ""
            if style.lower().startswith(("heading", "title")) or _looks_like_heading(text):
                current_heading = text
            sections.append(DocumentSection(
                text=text,
                heading=current_heading,
                paragraph_number=paragraph_number,
            ))
        return sections, {
            "parser": "openxml",
            "sourceFormat": "docx",
            "paragraphCount": paragraph_number,
            "headingCount": len({item.heading for item in sections if item.heading}),
            "ocrRecommended": False,
        }


def _pptx_sections(content: bytes) -> tuple[list[DocumentSection], dict[str, Any]]:
    with ZipFile(BytesIO(content)) as archive:
        names = sorted(
            (name for name in archive.namelist()
             if name.startswith("ppt/slides/slide") and name.endswith(".xml")
             and name[16:-4].isdigit()),
            key=lambda name: int(name[16:-4]),
        )
        if not names or len(names) > 200:
            raise ValueError("Office 文档无正文或幻灯片过多")
        sections: list[DocumentSection] = []
        for slide_number, name in enumerate(names, start=1):
            root = ElementTree.fromstring(_read_xml(archive, name))
            paragraphs = []
            for paragraph in root.iter(f"{_A}p"):
                text = "".join(node.text or "" for node in paragraph.iter(f"{_A}t")).strip()
                if text:
                    paragraphs.append(text)
            if paragraphs:
                sections.append(DocumentSection(
                    text="\n".join(paragraphs),
                    heading=paragraphs[0] if len(paragraphs[0]) <= 80 else None,
                    slide_number=slide_number,
                ))
        return sections, {
            "parser": "openxml",
            "sourceFormat": "pptx",
            "slideCount": len(names),
            "ocrRecommended": False,
        }


def _read_xml(archive: ZipFile, name: str) -> bytes:
    info = archive.getinfo(name)
    if info.file_size > MAX_XML_BYTES:
        raise ValueError("Office 文档解压文本超过 8 MB 上限")
    xml = archive.read(name)
    if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
        raise ValueError("Office 文档包含不允许的 XML 声明")
    return xml


def _normalize_lines(text: str) -> str:
    lines = text.replace("\r\n", "\n").split("\n")
    return "\n".join(line.strip() for line in lines if line.strip())


def _guess_heading(text: str) -> str | None:
    first_line = text.split("\n", 1)[0].strip()
    has_body = len(text) > len(first_line) + 10
    if _looks_like_heading(first_line) or (has_body and len(first_line) <= 24):
        return first_line
    return None


def _looks_like_heading(text: str) -> bool:
    value = text.strip()
    if not value or len(value) > 80 or value.endswith(("。", "！", "？", ".", "!", "?")):
        return False
    return bool(re.match(
        r"^(?:#{1,6}\s+|第[一二三四五六七八九十百0-9]+[章节课]|"
        r"[一二三四五六七八九十]+、|\d+(?:\.\d+)*[ .、])",
        value,
    ))
