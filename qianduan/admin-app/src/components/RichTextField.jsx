import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const IMAGE_PRESETS = [
  { label: "小", value: "25%" },
  { label: "中", value: "50%" },
  { label: "大", value: "75%" },
  { label: "通栏", value: "100%" },
];

/** 支持自定义宽度的插图节点。 */
const ResizableImage = Image.extend({
  name: "image",
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "50%",
        parseHTML: (element) => {
          const attr = element.getAttribute("width");
          const styleWidth = element.style?.width;
          if (styleWidth) return styleWidth;
          if (attr) return /^\d+$/.test(attr) ? `${attr}px` : attr;
          return "50%";
        },
        renderHTML: (attributes) => {
          const width = attributes.width || "50%";
          const isPercent = String(width).includes("%");
          const isPx = /px$/i.test(String(width)) || /^\d+$/.test(String(width));
          const normalized = isPx && !String(width).includes("px") ? `${width}px` : width;
          return {
            width: isPercent ? undefined : String(normalized).replace(/px$/i, ""),
            style: `width: ${normalized}; height: auto; max-width: 100%;`,
            "data-width": normalized,
          };
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) => (attributes.alt ? { alt: attributes.alt } : {}),
      },
      objectKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-object-key"),
        renderHTML: (attributes) => (attributes.objectKey ? { "data-object-key": attributes.objectKey } : {}),
      },
    };
  },
});

function looksLikeHtml(value) {
  const text = String(value || "").trim();
  return /^</.test(text) || /<\/(p|div|h[1-6]|ul|ol|li|strong|em|u|a|img|blockquote|pre|code)\b/i.test(text);
}

function toEditorHtml(value) {
  const text = value == null ? "" : String(value);
  if (!text.trim()) return "";
  if (looksLikeHtml(text)) return text;
  return `<p>${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")}</p>`;
}

function normalizeUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  if (/^(https?:|mailto:|\/)/i.test(url)) return url;
  return `https://${url}`;
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

function ToolbarButton({ active, disabled, title, onClick, children }) {
  return (
    <button
      className={`rich-toolbar-btn${active ? " is-active" : ""}`}
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function LinkDialog({ open, initialHref = "", initialText = "", onClose, onApply, onRemove, canRemove }) {
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const [openBlank, setOpenBlank] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setHref(initialHref);
    setText(initialText);
    setOpenBlank(true);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, initialHref, initialText]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit(event) {
    event.preventDefault();
    const nextHref = normalizeUrl(href);
    if (!nextHref) return;
    onApply({ href: nextHref, text: text.trim(), openBlank });
  }

  return createPortal(
    <div className="rich-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="rich-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rich-link-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="rich-dialog-head">
          <strong id="rich-link-title">插入链接</strong>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}><X size={16} /></button>
        </header>
        <label className="rich-dialog-field">
          链接地址
          <input
            ref={inputRef}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
            required
          />
        </label>
        <label className="rich-dialog-field">
          显示文字（可选）
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="留空则使用选中文本或地址"
          />
        </label>
        <label className="rich-dialog-check">
          <input type="checkbox" checked={openBlank} onChange={(event) => setOpenBlank(event.target.checked)} />
          在新标签页打开
        </label>
        <div className="rich-dialog-actions">
          {canRemove ? (
            <button className="button ghost compact" type="button" onClick={onRemove}>
              <Unlink size={14} />移除链接
            </button>
          ) : <span />}
          <div className="rich-dialog-actions-right">
            <button className="button ghost compact" type="button" onClick={onClose}>取消</button>
            <button className="button primary compact" type="submit">应用</button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function ImageSizePanel({ editor }) {
  if (!editor?.isActive("image")) return null;
  const attrs = editor.getAttributes("image");
  const width = attrs.width || "50%";
  const numeric = String(width).replace(/%|px/gi, "");

  function applyWidth(next) {
    editor.chain().focus().updateAttributes("image", { width: next }).run();
  }

  return (
    <div className="rich-image-panel" role="toolbar" aria-label="图片尺寸">
      <span className="rich-image-panel-label">图片宽度</span>
      <div className="rich-image-presets">
        {IMAGE_PRESETS.map((item) => (
          <button
            key={item.value}
            className={`rich-chip${width === item.value ? " is-active" : ""}`}
            type="button"
            onClick={() => applyWidth(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="rich-image-custom">
        自定义
        <input
          type="number"
          min={10}
          max={2000}
          value={/^\d+(\.\d+)?$/.test(numeric) ? numeric : ""}
          placeholder="如 320"
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            applyWidth(`${value}px`);
          }}
        />
        <span>px</span>
      </label>
      <label className="rich-image-custom">
        或 %
        <input
          type="number"
          min={5}
          max={100}
          value={String(width).includes("%") ? numeric : ""}
          placeholder="50"
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            applyWidth(`${Math.min(100, Number(value))}%`);
          }}
        />
        <span>%</span>
      </label>
      <button
        className="button ghost compact"
        type="button"
        title="删除图片"
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        <Trash2 size={14} />删除
      </button>
    </div>
  );
}

function EditorToolbar({ editor, onInsertImage, uploading, onOpenLink }) {
  if (!editor) return null;

  return (
    <div className="rich-toolbar" role="toolbar" aria-label="富文本工具栏">
      <ToolbarButton title="撤销" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="重做" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={15} />
      </ToolbarButton>
      <span className="rich-toolbar-sep" />
      <ToolbarButton title="加粗" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton title="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton title="下划线" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={15} />
      </ToolbarButton>
      <ToolbarButton title="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={15} />
      </ToolbarButton>
      <span className="rich-toolbar-sep" />
      <ToolbarButton title="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton title="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton title="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton title="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} />
      </ToolbarButton>
      <span className="rich-toolbar-sep" />
      <ToolbarButton title="链接" active={editor.isActive("link")} onClick={onOpenLink}>
        <Link2 size={15} />
      </ToolbarButton>
      {onInsertImage ? (
        <label className={`rich-toolbar-btn${uploading ? " is-busy" : ""}`} title={uploading ? "上传中…" : "插入图片"}>
          <ImagePlus size={15} />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            hidden
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onInsertImage(file);
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function FullscreenShell({ title, children, onClose }) {
  return createPortal(
    <div className="editor-fullscreen" role="dialog" aria-modal="true" aria-label={`${title}全屏编辑`}>
      <header className="editor-fullscreen-bar">
        <strong>{title}</strong>
        <div className="editor-fullscreen-actions">
          <span className="editor-fullscreen-hint">Esc 退出全屏</span>
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

/**
 * 论坛式富文本：自定义链接弹层、插图尺寸、选区气泡工具条。
 */
export function RichTextField({
  label = "教学内容",
  value,
  onChange,
  required = false,
  maxLength = 100000,
  placeholder = "在此编写正文，可插入图片、下划线、列表等…",
  hint = "支持加粗、斜体、下划线、标题、列表、链接与可调尺寸插图。",
  onUploadImage,
  resetKey = "default",
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageSelected, setImageSelected] = useState(false);
  const fieldId = useId();
  const close = useCallback(() => setExpanded(false), []);

  useFullscreenLock(expanded);
  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape" && !linkOpen) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close, linkOpen]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor: current }) => {
      const html = current.isEmpty ? "" : current.getHTML();
      if (html.length > maxLength) {
        setError(`内容不能超过 ${maxLength} 个字符`);
        return;
      }
      setError("");
      onChange(html);
    },
    onSelectionUpdate: ({ editor: current }) => {
      setImageSelected(current.isActive("image"));
    },
    editorProps: {
      attributes: {
        class: "rich-editor-surface",
        "aria-labelledby": fieldId,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(toEditorHtml(value), false);
    setError("");
    setImageSelected(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  const linkSeed = (() => {
    if (!editor) return { href: "", text: "" };
    const attrs = editor.getAttributes("link");
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    return { href: attrs.href || "", text: selected };
  })();

  function openLinkDialog() {
    setLinkOpen(true);
  }

  function applyLink({ href, text, openBlank }) {
    if (!editor) return;
    const attrs = {
      href,
      target: openBlank ? "_blank" : null,
      rel: openBlank ? "noopener noreferrer" : null,
    };
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? "" : editor.state.doc.textBetween(from, to, " ");
    const label = text || selected || href;

    if (!empty && text && text !== selected) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          { type: "text", text: label, marks: [{ type: "link", attrs }] },
        )
        .run();
    } else if (!empty) {
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs }] })
        .run();
    }
    setLinkOpen(false);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  async function insertImage(file) {
    if (!onUploadImage || !editor) return;
    setUploading(true);
    setError("");
    try {
      const result = await onUploadImage(file);
      const url = result?.url || result;
      const objectKey = result?.objectKey || null;
      if (!url) throw new Error("未返回图片地址");
      editor.chain().focus().setImage({
        src: url,
        alt: file.name || "插图",
        width: "50%",
        objectKey: objectKey || undefined,
      }).run();
      setImageSelected(true);
    } catch (uploadError) {
      setError(uploadError.message || "图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  const shell = (
    <div className={`rich-field-shell${expanded ? " is-fullscreen-inner" : ""}`}>
      <EditorToolbar
        editor={editor}
        onInsertImage={onUploadImage ? insertImage : undefined}
        uploading={uploading}
        onOpenLink={openLinkDialog}
      />
      {imageSelected ? <ImageSizePanel editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );

  return (
    <div className={`rich-field${expanded ? " is-expanded" : ""}`}>
      <div className="rich-field-head">
        <span id={fieldId}>{label}{required ? "" : "（可选）"}</span>
        <button className="button ghost compact" type="button" onClick={() => setExpanded(true)} title="全屏编写">
          <Maximize2 size={15} />全屏编写
        </button>
      </div>
      {!expanded && shell}
      <textarea
        className="rich-field-mirror"
        value={value || ""}
        required={required}
        maxLength={maxLength}
        tabIndex={-1}
        aria-hidden
        readOnly
      />
      {!expanded && <small className="markdown-hint">{hint}</small>}
      {(error || uploading) && (
        <small className={error ? "rich-field-error" : "markdown-hint"}>
          {error || "正在上传插图…"}
        </small>
      )}
      {expanded && (
        <FullscreenShell title={label} onClose={close}>
          {shell}
        </FullscreenShell>
      )}
      <LinkDialog
        open={linkOpen}
        initialHref={linkSeed.href}
        initialText={linkSeed.text}
        canRemove={Boolean(linkSeed.href)}
        onClose={() => setLinkOpen(false)}
        onApply={applyLink}
        onRemove={removeLink}
      />
    </div>
  );
}
