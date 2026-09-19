"""生成「人工智能通识 · 正式演示」真实 PDF 讲义（可上传管理端 / 可入库）。"""

from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
DATA_JSON = ROOT / "data" / "formal_ai_literacy_knowledge.json"
OUT_DIR = ROOT / "data" / "formal_materials"

# 与 MySQL 正式演示资料标题对齐的三份（管理端应上传这三份）
PUBLISH_TITLES = {
    "讲义 · 什么是数据",
    "讲义 · 特征与标签",
    "讲义 · 提示词与负责任使用",
}

FONT_CANDIDATES = (
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
    Path(r"C:\Windows\Fonts\simsun.ttc"),
)


def _register_font() -> str:
    for path in FONT_CANDIDATES:
        if path.is_file():
            name = "K12CN"
            pdfmetrics.registerFont(TTFont(name, str(path)))
            return name
    raise RuntimeError("未找到中文字体（msyh/simhei/simsun），无法生成 PDF")


def _safe_filename(title: str) -> str:
    return (
        title.replace(" · ", "-")
        .replace(" ", "")
        .replace("/", "-")
        .replace("\\", "-")
        + ".pdf"
    )


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def write_pdf(path: Path, title: str, body: str, font_name: str) -> None:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleCN",
        parent=styles["Title"],
        fontName=font_name,
        fontSize=16,
        leading=22,
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        "BodyCN",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=11,
        leading=18,
    )
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=title,
        author="K12 正式演示",
    )
    story = [
        Paragraph(_escape(title), title_style),
        Spacer(1, 0.3 * cm),
        Paragraph(_escape(body), body_style),
    ]
    doc.build(story)


def main() -> None:
    font_name = _register_font()
    items = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for item in items:
        title = str(item["title"])
        # 全量生成；其中三份对应管理端已有元数据
        path = OUT_DIR / _safe_filename(title)
        write_pdf(path, title, str(item["content"]), font_name)
        written.append(path)
        mark = " [管理端对应]" if title in PUBLISH_TITLES else ""
        print(f"wrote {path.name} ({path.stat().st_size} bytes){mark}")
    manifest = OUT_DIR / "README.txt"
    manifest.write_text(
        "\n".join(
            [
                "正式演示讲义 PDF（真实可提取文本，可供管理端上传与入库）",
                "",
                "管理端操作：教学资料 → 打开占位资料 → 重新上传下方对应 PDF → 保存 → 审核/发布 → 入库",
                "",
                "优先上传这三份（与正式演示课资料标题对应）：",
                "- 讲义-什么是数据.pdf",
                "- 讲义-特征与标签.pdf",
                "- 讲义-提示词与负责任使用.pdf",
                "",
                "全部已生成文件：",
                *[f"- {p.name}" for p in written],
            ]
        ),
        encoding="utf-8",
    )
    print(f"output_dir={OUT_DIR}")


if __name__ == "__main__":
    main()
