import {
  BookOpenCheck, CheckCircle2, Edit3, Eye, LoaderCircle, Plus, RefreshCw,
  Send, Trash2, Undo2, UploadCloud, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { pictureBooksAdminApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";

const STATUS = {
  DRAFT: ["草稿", "draft"],
  PENDING_REVIEW: ["待审核", "pending"],
  APPROVED: ["审核通过", "enabled"],
  PUBLISHED: ["已发布", "enabled"],
  OFFLINE: ["已下架", "disabled"],
};

const STAGES = [
  ["PRIMARY_LOWER", "小学低年级"], ["PRIMARY_UPPER", "小学高年级"],
  ["JUNIOR_HIGH", "初中"], ["SENIOR_HIGH", "高中"],
];

const emptyPage = (pageNo = 1) => ({
  pageNo, title: "", narration: "", prompt: "", imageObjectKey: "",
  imageFallbackUrl: "/assets/experience/primary/mascot-wave.webp", altText: "", interaction: null,
});

const emptyBook = {
  bookCode: "", title: "", subtitle: "", summary: "", stageCode: "PRIMARY_LOWER",
  knowledgeCode: "", coverObjectKey: "", coverFallbackUrl: "/assets/experience/primary/student-reading.webp",
  challengeType: "AI_TOPIC", challengeReference: "", sortOrder: 0, pages: [emptyPage()],
};

function toForm(book) {
  if (!book) return structuredClone(emptyBook);
  return {
    bookCode: book.bookCode, title: book.title, subtitle: book.subtitle || "", summary: book.summary,
    stageCode: book.stageCode, knowledgeCode: book.knowledgeCode,
    coverObjectKey: book.coverObjectKey || "", coverFallbackUrl: book.coverFallbackUrl || "",
    challengeType: book.challengeType, challengeReference: book.challengeReference,
    sortOrder: book.sortOrder || 0, lockVersion: book.lockVersion,
    pages: (book.pages || []).map((page) => ({
      pageNo: page.pageNo, title: page.title, narration: page.narration, prompt: page.prompt || "",
      imageObjectKey: page.imageObjectKey || "", imageFallbackUrl: page.imageFallbackUrl || "",
      altText: page.altText, interaction: page.interaction || null,
    })),
  };
}

function payload(form, editing) {
  const result = {
    ...form,
    sortOrder: Number(form.sortOrder || 0),
    coverObjectKey: form.coverObjectKey.trim() || null,
    coverFallbackUrl: form.coverFallbackUrl.trim() || null,
    pages: form.pages.map((page, index) => ({
      ...page, pageNo: index + 1,
      imageObjectKey: page.imageObjectKey.trim() || null,
      imageFallbackUrl: page.imageFallbackUrl.trim() || null,
      prompt: page.prompt.trim() || null,
    })),
  };
  if (editing) delete result.bookCode;
  return result;
}

export function PictureBookManagement({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(structuredClone(emptyBook));
  const [detail, setDetail] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try { setItems(await pictureBooksAdminApi.list() || []); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((item) => item.status === "PUBLISHED").length,
    review: items.filter((item) => item.status === "PENDING_REVIEW").length,
  }), [items]);

  function openEditor(book = null) {
    setEditor(book || {});
    setForm(toForm(book));
  }

  function updatePage(index, field, value) {
    setForm((current) => ({
      ...current,
      pages: current.pages.map((page, pageIndex) => pageIndex === index ? { ...page, [field]: value } : page),
    }));
  }

  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      if (editor?.id) await pictureBooksAdminApi.update(editor.id, payload(form, true));
      else await pictureBooksAdminApi.create(payload(form, false));
      notify(editor?.id ? "绘本草稿已更新" : "绘本草稿已创建");
      setEditor(null); await load();
    } catch (cause) { notify(cause.message, "error"); }
    finally { setBusy(false); }
  }

  async function action(name, book, note = "") {
    if (name === "remove" && !window.confirm(`确认删除草稿「${book.title}」？`)) return;
    setBusy(true);
    try {
      if (["approve", "reject"].includes(name)) await pictureBooksAdminApi[name](book.id, note);
      else await pictureBooksAdminApi[name](book.id);
      notify({ submit: "已提交审核", approve: "审核已通过", reject: "已退回修改", publish: "已发布到学生端", offline: "已下架", remove: "草稿已删除" }[name]);
      setReview(null); setReviewNote(""); await load();
    } catch (cause) { notify(cause.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <section className="page-section picture-book-admin">
      <header className="page-heading">
        <div><p className="eyebrow">REVIEWED PICTURE BOOKS</p><h1>互动绘本审核</h1><p>按草稿、审核、发布流程管理低龄教学绘本。图片支持 MinIO 对象键和本地保底资源。</p></div>
        <button className="button primary" type="button" onClick={() => openEditor()}><Plus size={17} />新建绘本</button>
      </header>
      <div className="metric-row">
        <article><span className="metric-icon blue"><BookOpenCheck /></span><div><strong>{stats.total}</strong><small>全部绘本</small></div></article>
        <article><span className="metric-icon green"><CheckCircle2 /></span><div><strong>{stats.published}</strong><small>学生端可见</small></div></article>
        <article><span className="metric-icon amber"><Eye /></span><div><strong>{stats.review}</strong><small>等待教研审核</small></div></article>
      </div>
      <div className="data-panel">
        <div className="table-toolbar"><strong>绘本内容库</strong><button className="icon-button" type="button" title="刷新" onClick={load}><RefreshCw size={18} /></button></div>
        {loading ? <div className="admin-empty"><LoaderCircle className="spin" />正在加载…</div>
          : error ? <div className="admin-empty table-error">{error}<button className="button" type="button" onClick={load}>重试</button></div>
            : items.length === 0 ? <div className="admin-empty">尚未建表或没有绘本，请先执行绘本升级 SQL。</div>
              : <div className="picture-book-admin-grid">{items.map((book) => {
                const status = STATUS[book.status] || [book.status, "disabled"];
                return <article className="picture-book-admin-card" key={book.id}>
                  <img src={book.coverUrl} alt="" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
                  <div className="picture-book-admin-card-body">
                    <div className="card-meta"><span className={`status ${status[1]}`}>{status[0]}</span><small>v{book.contentVersion}</small></div>
                    <h3>{book.title}</h3><p>{book.summary}</p>
                    <small>{book.stageCode} · {book.knowledgeCode} · {book.pages?.length || 0} 页</small>
                  </div>
                  <footer className="picture-book-admin-actions">
                    <button type="button" onClick={() => setDetail(book)}><Eye size={14} />预览</button>
                    {!["PUBLISHED", "PENDING_REVIEW"].includes(book.status) && <button type="button" onClick={() => openEditor(book)}><Edit3 size={14} />编辑</button>}
                    {book.status === "DRAFT" && <button type="button" onClick={() => action("submit", book)}><Send size={14} />送审</button>}
                    {book.status === "PENDING_REVIEW" && <button type="button" onClick={() => { setReview({ type: "approve", book }); setReviewNote(""); }}><CheckCircle2 size={14} />审核</button>}
                    {book.status === "APPROVED" && <button type="button" onClick={() => action("publish", book)}><UploadCloud size={14} />发布</button>}
                    {book.status === "PUBLISHED" && <button type="button" onClick={() => action("offline", book)}><Undo2 size={14} />下架</button>}
                    {book.status === "DRAFT" && <button className="danger" type="button" onClick={() => action("remove", book)}><Trash2 size={14} />删除</button>}
                  </footer>
                </article>;
              })}</div>}
      </div>

      {editor && <Modal variant="workspace" title={editor.id ? "编辑互动绘本" : "新建互动绘本"} description="保存后仍是草稿；提交、审核并发布后学生端才可见。" onClose={() => setEditor(null)}>
        <form className="picture-book-editor" onSubmit={save}>
          <section className="picture-book-form-grid">
            <label>绘本编码<input value={form.bookCode} disabled={Boolean(editor.id)} pattern="[a-z0-9-]+" required onChange={(e) => setForm({ ...form, bookCode: e.target.value })} /></label>
            <label>标题<input value={form.title} maxLength={100} required onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>副标题<input value={form.subtitle} maxLength={200} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></label>
            <label>学段<select value={form.stageCode} onChange={(e) => setForm({ ...form, stageCode: e.target.value })}>{STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>知识点编码<input value={form.knowledgeCode} required onChange={(e) => setForm({ ...form, knowledgeCode: e.target.value })} /></label>
            <label>排序<input type="number" min="0" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label>
            <label>互动类型<select value={form.challengeType} onChange={(e) => setForm({ ...form, challengeType: e.target.value })}><option value="CAT_LESSON">图片分类课</option><option value="VISUAL_MISSION">图形化任务</option><option value="AI_TOPIC">AI 主题</option></select></label>
            <label>互动引用<input value={form.challengeReference} required onChange={(e) => setForm({ ...form, challengeReference: e.target.value })} /></label>
            <label>封面对象键<input value={form.coverObjectKey} placeholder="course-assets/..." onChange={(e) => setForm({ ...form, coverObjectKey: e.target.value })} /></label>
            <label>封面保底路径<input value={form.coverFallbackUrl} placeholder="/assets/..." onChange={(e) => setForm({ ...form, coverFallbackUrl: e.target.value })} /></label>
            <label className="span-2">简介<textarea value={form.summary} maxLength={600} required onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
          </section>
          <div className="picture-book-pages-heading"><div><h3>绘本页面</h3><p>每页使用短句讲解，并填写无障碍图片说明。</p></div><button className="button" type="button" onClick={() => setForm((current) => ({ ...current, pages: [...current.pages, emptyPage(current.pages.length + 1)] }))}><Plus size={15} />增加一页</button></div>
          <div className="picture-book-page-list">{form.pages.map((page, index) => <article key={index}>
            <header><strong>第 {index + 1} 页</strong>{form.pages.length > 1 && <button className="icon-button danger" type="button" title="删除页面" onClick={() => setForm((current) => ({ ...current, pages: current.pages.filter((_, i) => i !== index) }))}><Trash2 size={16} /></button>}</header>
            <label>页标题<input value={page.title} required onChange={(e) => updatePage(index, "title", e.target.value)} /></label>
            <label>朗读文字<textarea value={page.narration} maxLength={1200} required onChange={(e) => updatePage(index, "narration", e.target.value)} /></label>
            <label>引导提问<textarea value={page.prompt} maxLength={500} onChange={(e) => updatePage(index, "prompt", e.target.value)} /></label>
            <label>图片对象键<input value={page.imageObjectKey} placeholder="course-assets/..." onChange={(e) => updatePage(index, "imageObjectKey", e.target.value)} /></label>
            <label>图片保底路径<input value={page.imageFallbackUrl} placeholder="/assets/..." onChange={(e) => updatePage(index, "imageFallbackUrl", e.target.value)} /></label>
            <label>图片说明<input value={page.altText} maxLength={300} required onChange={(e) => updatePage(index, "altText", e.target.value)} /></label>
          </article>)}</div>
          <div className="workspace-footer"><button className="button ghost" type="button" onClick={() => setEditor(null)}>取消</button><button className="button primary" disabled={busy} type="submit">{busy ? "保存中…" : "保存草稿"}</button></div>
        </form>
      </Modal>}

      {detail && <Modal title={detail.title} description={`${detail.pages?.length || 0} 页 · ${STATUS[detail.status]?.[0] || detail.status}`} width={760} onClose={() => setDetail(null)}>
        <div className="picture-book-preview">{detail.pages?.map((page) => <article key={page.id || page.pageNo}><img src={page.imageUrl} alt={page.altText} /><div><small>第 {page.pageNo} 页</small><h3>{page.title}</h3><p>{page.narration}</p>{page.prompt && <blockquote>{page.prompt}</blockquote>}</div></article>)}</div>
      </Modal>}

      {review && <Modal title="教研审核" description={review.book.title} width={500} onClose={() => setReview(null)}>
        <div className="resource-form"><label>审核意见<textarea value={reviewNote} maxLength={1000} onChange={(e) => setReviewNote(e.target.value)} /></label><div><button className="button danger-solid" disabled={busy || !reviewNote.trim()} type="button" onClick={() => action("reject", review.book, reviewNote)}><XCircle size={15} />退回</button><button className="button primary" disabled={busy} type="button" onClick={() => action("approve", review.book, reviewNote)}><CheckCircle2 size={15} />批准</button></div></div>
      </Modal>}
    </section>
  );
}
