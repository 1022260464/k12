import { Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ children, className = "" }) {
  const text = children == null ? "" : String(children);
  if (!text.trim()) return null;
  return (
    <div className={`markdown-body ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function useFullscreenLock(expanded) {
  useEffect(() => {
    if (!expanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);
}

function useEscapeToClose(expanded, onClose) {
  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onClose]);
}

function FullscreenShell({ title, hint, actions, children, onClose }) {
  return createPortal(
    <div className="editor-fullscreen" role="dialog" aria-modal="true" aria-label={`${title}全屏编辑`}>
      <header className="editor-fullscreen-bar">
        <strong>{title}</strong>
        <div className="editor-fullscreen-actions">
          {hint ? <span className="editor-fullscreen-hint">{hint}</span> : null}
          {actions}
          <button className="button ghost compact" type="button" onClick={onClose}>
            <Minimize2 size={15} />退出全屏
          </button>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="editor-fullscreen-body">{children}</div>
    </div>,
    document.body,
  );
}

/** 普通长文本：支持一键全屏编辑，便于查看上下文。 */
export function ExpandableTextarea({
  label,
  value,
  onChange,
  required = false,
  maxLength,
  placeholder = "",
  className = "",
  rows,
}) {
  const [expanded, setExpanded] = useState(false);
  const fieldId = useId();
  const close = useCallback(() => setExpanded(false), []);

  useFullscreenLock(expanded);
  useEscapeToClose(expanded, close);

  return (
    <div className={`expandable-field${expanded ? " is-expanded" : ""}`}>
      <div className="expandable-field-head">
        <label htmlFor={fieldId}>{label}</label>
        <button className="button ghost compact" type="button" onClick={() => setExpanded(true)} title="全屏编辑">
          <Maximize2 size={15} />全屏编写
        </button>
      </div>
      {/* 保留在表单内，全屏时仅作校验/取值载体 */}
      <textarea
        id={expanded ? undefined : fieldId}
        className={`expandable-textarea ${className}`.trim()}
        value={value}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        rows={rows}
        tabIndex={expanded ? -1 : undefined}
        aria-hidden={expanded || undefined}
        style={expanded ? { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 } : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {expanded && (
        <FullscreenShell title={label} hint="Esc 退出全屏" onClose={close}>
          <textarea
            id={fieldId}
            className={`expandable-textarea ${className}`.trim()}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={rows}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
          />
        </FullscreenShell>
      )}
    </div>
  );
}

export function MarkdownField({
  label = "教学内容",
  value,
  onChange,
  required = false,
  maxLength = 20000,
  placeholder = "支持 Markdown：**加粗**、*斜体*、- 列表、`代码`、链接等",
  hint = "使用 Markdown 编写；学生端会渲染加粗、列表、标题等格式。",
}) {
  const [mode, setMode] = useState("edit");
  const [expanded, setExpanded] = useState(false);
  const close = useCallback(() => setExpanded(false), []);

  useFullscreenLock(expanded);
  useEscapeToClose(expanded, close);

  const modeTabs = (
    <div className="markdown-mode-tabs" role="tablist">
      <button className={mode === "edit" ? "active" : ""} type="button" role="tab" aria-selected={mode === "edit"} onClick={() => setMode("edit")}>编辑</button>
      <button className={mode === "preview" ? "active" : ""} type="button" role="tab" aria-selected={mode === "preview"} onClick={() => setMode("preview")}>预览</button>
    </div>
  );

  return (
    <div className={`markdown-field${expanded ? " is-expanded" : ""}`}>
      <div className="markdown-field-head">
        <span>{label}{required ? "" : "（可选）"}</span>
        <div className="markdown-field-tools">
          {modeTabs}
          <button className="button ghost compact" type="button" onClick={() => setExpanded(true)} title="全屏编写">
            <Maximize2 size={15} />全屏编写
          </button>
        </div>
      </div>
      {!expanded && mode === "edit" && (
        <textarea
          className="markdown-editor"
          value={value}
          maxLength={maxLength}
          required={required}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {!expanded && mode === "preview" && (
        <div className="markdown-preview">
          {value?.trim() ? <MarkdownContent>{value}</MarkdownContent> : <p className="binding-empty">暂无内容可预览</p>}
        </div>
      )}
      {/* 预览/全屏时仍保留表单内字段，避免 required 校验失效 */}
      {(expanded || mode === "preview") && (
        <textarea
          className="markdown-editor"
          value={value}
          maxLength={maxLength}
          required={required}
          tabIndex={-1}
          aria-hidden
          style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {!expanded && <small className="markdown-hint">{hint}</small>}
      {expanded && (
        <FullscreenShell
          title={label}
          hint="Esc 退出全屏 · 支持 Markdown"
          actions={modeTabs}
          onClose={close}
        >
          {mode === "edit" ? (
            <textarea
              className="markdown-editor"
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              autoFocus
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <div className="markdown-preview">
              {value?.trim() ? <MarkdownContent>{value}</MarkdownContent> : <p className="binding-empty">暂无内容可预览</p>}
            </div>
          )}
        </FullscreenShell>
      )}
    </div>
  );
}
