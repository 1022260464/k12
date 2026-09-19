"""从审核通过的资料中提取可检索文本；不做 OCR 或视频转写。"""

from io import BytesIO
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader

MAX_INDEX_BYTES = 20 * 1024 * 1024
MAX_XML_BYTES = 8 * 1024 * 1024
MAX_TEXT_CHARS = 200_000
MAX_PDF_PAGES = 100


def extract_text(content: bytes, extension: str) -> str:
    if not content or len(content) > MAX_INDEX_BYTES:
        raise ValueError("资料为空或超过 20 MB 入库上限")
    try:
        if extension == "pdf":
            parts = _pdf_parts(content)
        elif extension in {"docx", "pptx"}:
            parts = _office_parts(content, extension)
        else:
            raise ValueError("当前只支持 PDF、DOCX、PPTX 文本入库")
    except (BadZipFile, ElementTree.ParseError, OSError, KeyError) as error:
        raise ValueError("资料文件损坏或格式不正确") from error

    text = "\n".join(part.strip() for part in parts if part and part.strip())
    if not text:
        raise ValueError("未提取到文本；扫描版 PDF 需要先进行 OCR")
    if len(text) > MAX_TEXT_CHARS:
        raise ValueError("提取文本超过 20 万字符，请拆分资料后入库")
    return text


def _pdf_parts(content: bytes) -> list[str]:
    try:
        reader = PdfReader(BytesIO(content), strict=False)
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ValueError("PDF 超过 100 页，请拆分后入库")
        return [page.extract_text() or "" for page in reader.pages]
    except ValueError:
        raise
    except Exception as error:  # noqa: BLE001
        raise ValueError("PDF 无法解析") from error


def _office_parts(content: bytes, extension: str) -> list[str]:
    with ZipFile(BytesIO(content)) as archive:
        if extension == "docx":
            names = ["word/document.xml"]
            paragraph_tag = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
            text_tag = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
        else:
            names = sorted(
                (name for name in archive.namelist() if name.startswith("ppt/slides/slide")
                 and name.endswith(".xml") and name[16:-4].isdigit()),
                key=lambda name: int(name[16:-4]),
            )
            paragraph_tag = "{http://schemas.openxmlformats.org/drawingml/2006/main}p"
            text_tag = "{http://schemas.openxmlformats.org/drawingml/2006/main}t"
        if not names or len(names) > 200:
            raise ValueError("Office 文档无正文或幻灯片过多")

        total_bytes = 0
        parts: list[str] = []
        for name in names:
            info = archive.getinfo(name)
            total_bytes += info.file_size
            if total_bytes > MAX_XML_BYTES:
                raise ValueError("Office 文档解压文本超过 8 MB 上限")
            xml = archive.read(name)
            if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
                raise ValueError("Office 文档包含不允许的 XML 声明")
            root = ElementTree.fromstring(xml)
            for paragraph in root.iter(paragraph_tag):
                text = "".join(node.text or "" for node in paragraph.iter(text_tag))
                if text.strip():
                    parts.append(text)
        return parts
