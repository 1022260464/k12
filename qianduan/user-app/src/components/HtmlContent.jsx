import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function looksLikeHtml(value) {
  const text = String(value || "").trim();
  return /^</.test(text) || /<\/(p|div|h[1-6]|ul|ol|li|strong|em|u|a|img|blockquote|pre|code|span)\b/i.test(text);
}

const PURIFY = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel", "width", "height", "style", "data-width", "class"],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/** 课程正文：富文本 HTML 优先；历史 Markdown 仍可渲染。 */
export function HtmlContent({ children, className = "" }) {
  const text = children == null ? "" : String(children);
  if (!text.trim()) return null;

  if (looksLikeHtml(text)) {
    const safe = DOMPurify.sanitize(text, PURIFY);
    return (
      <div
        className={`markdown-body lesson-text rich-html ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }

  return (
    <div className={`markdown-body lesson-text ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

/** @deprecated 使用 HtmlContent；保留别名以兼容旧引用。 */
export function MarkdownContent(props) {
  return <HtmlContent {...props} />;
}
