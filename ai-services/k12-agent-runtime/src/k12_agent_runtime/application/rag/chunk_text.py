import re
from dataclasses import dataclass, field
from typing import Any

from k12_agent_runtime.domain.rag import DocumentSection


@dataclass(frozen=True, slots=True)
class StructuredChunk:
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


class TextChunker:
    """优先按标题和来源段切分，超长段再使用带重叠的字符窗口。"""

    def __init__(self, chunk_size: int, overlap: int) -> None:
        if chunk_size < 100:
            raise ValueError("chunk_size不能小于100")
        if overlap < 0 or overlap >= chunk_size:
            raise ValueError("overlap必须大于等于0且小于chunk_size")
        self._chunk_size = chunk_size
        self._overlap = overlap

    def split(self, content: str) -> tuple[str, ...]:
        return tuple(item.text for item in self.split_structured(content))

    def split_structured(
        self,
        content: str,
        sections: tuple[DocumentSection, ...] = (),
    ) -> tuple[StructuredChunk, ...]:
        if not sections:
            return tuple(StructuredChunk(text=item) for item in self._split_text(content))

        chunks: list[StructuredChunk] = []
        pending_text = ""
        pending_metadata: dict[str, Any] = {}
        for section in sections:
            normalized = self._normalize(section.text)
            if not normalized:
                continue
            section_metadata = self._section_metadata(section)
            pieces = self._split_text(normalized)
            for piece in pieces:
                if (
                    pending_text
                    and len(pending_text) + 2 + len(piece) <= self._chunk_size
                    and self._same_heading(pending_metadata, section_metadata)
                ):
                    pending_text = f"{pending_text}\n\n{piece}"
                    pending_metadata = self._merge_metadata(pending_metadata, section_metadata)
                    continue
                if pending_text:
                    chunks.append(StructuredChunk(pending_text, pending_metadata))
                pending_text = piece
                pending_metadata = section_metadata
        if pending_text:
            chunks.append(StructuredChunk(pending_text, pending_metadata))
        return tuple(chunks)

    def _split_text(self, content: str) -> tuple[str, ...]:
        normalized = self._normalize(content)
        if not normalized:
            return ()
        chunks: list[str] = []
        start = 0
        while start < len(normalized):
            maximum_end = min(start + self._chunk_size, len(normalized))
            end = self._find_boundary(normalized, start, maximum_end)
            chunk = normalized[start:end].strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(normalized):
                break
            start = max(end - self._overlap, start + 1)
        return tuple(chunks)

    @staticmethod
    def _normalize(content: str) -> str:
        return re.sub(r"[ \t]+", " ", content.replace("\r\n", "\n")).strip()

    def _find_boundary(self, content: str, start: int, maximum_end: int) -> int:
        if maximum_end >= len(content):
            return len(content)
        search_start = start + self._chunk_size * 3 // 5
        for separator in ("\n\n", "\n", "。", "！", "？", ";", "；"):
            boundary = content.rfind(separator, search_start, maximum_end)
            if boundary >= 0:
                return boundary + len(separator)
        return maximum_end

    @staticmethod
    def _section_metadata(section: DocumentSection) -> dict[str, Any]:
        metadata: dict[str, Any] = {}
        if section.heading:
            metadata["heading"] = section.heading
        for field_name, value in (
            ("page", section.page_number),
            ("slide", section.slide_number),
            ("paragraph", section.paragraph_number),
        ):
            if value is not None:
                metadata[f"{field_name}Start"] = value
                metadata[f"{field_name}End"] = value
        return metadata

    @staticmethod
    def _same_heading(left: dict[str, Any], right: dict[str, Any]) -> bool:
        return left.get("heading") == right.get("heading")

    @staticmethod
    def _merge_metadata(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
        merged = dict(left)
        for field_name in ("page", "slide", "paragraph"):
            start_key = f"{field_name}Start"
            end_key = f"{field_name}End"
            starts = [
                value
                for value in (left.get(start_key), right.get(start_key))
                if value is not None
            ]
            ends = [
                value
                for value in (left.get(end_key), right.get(end_key))
                if value is not None
            ]
            if starts:
                merged[start_key] = min(starts)
            if ends:
                merged[end_key] = max(ends)
        return merged
