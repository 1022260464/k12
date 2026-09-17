import re


class TextChunker:
    """按字符窗口切分中文教材，并在相邻片段间保留少量上下文。"""

    def __init__(self, chunk_size: int, overlap: int) -> None:
        if chunk_size < 100:
            raise ValueError("chunk_size不能小于100")
        if overlap < 0 or overlap >= chunk_size:
            raise ValueError("overlap必须大于等于0且小于chunk_size")
        self._chunk_size = chunk_size
        self._overlap = overlap

    def split(self, content: str) -> tuple[str, ...]:
        normalized = re.sub(r"[ \t]+", " ", content.replace("\r\n", "\n")).strip()
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

    def _find_boundary(self, content: str, start: int, maximum_end: int) -> int:
        if maximum_end >= len(content):
            return len(content)
        search_start = start + self._chunk_size * 3 // 5
        for separator in ("\n\n", "\n", "。", "！", "？", ";", "；"):
            boundary = content.rfind(separator, search_start, maximum_end)
            if boundary >= 0:
                return boundary + len(separator)
        return maximum_end
