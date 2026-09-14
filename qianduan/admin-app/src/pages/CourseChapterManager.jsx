import { Edit3, FileText, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { coursesApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";

const emptyChapter = { title: "", content: "", sortOrder: 1 };

export function CourseChapterManager({ course, notify, onClose }) {
  const [chapters, setChapters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyChapter);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setChapters(await coursesApi.chapters(course.id)); }
    catch (error) { notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [course.id]);

  async function edit(chapter) {
    try {
      const detail = await coursesApi.chapter(course.id, chapter.id);
      setEditing(detail);
      setForm({ title: detail.title, content: detail.content, sortOrder: detail.sortOrder });
    } catch (error) { notify(error.message, "error"); }
  }

  function create() {
    setEditing(null);
    setForm({ ...emptyChapter, sortOrder: chapters.length + 1 });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) };
      if (editing) await coursesApi.updateChapter(course.id, editing.id, payload);
      else await coursesApi.createChapter(course.id, payload);
      notify(editing ? "章节已更新" : "章节已创建");
      create();
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function remove(chapter) {
    if (!window.confirm(`确认删除章节“${chapter.title}”吗？`)) return;
    try { await coursesApi.removeChapter(course.id, chapter.id); notify("章节已删除"); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  return <Modal title={`章节管理 · ${course.title}`} description="维护章节顺序和纯文本教学内容。" onClose={onClose} width={980}>
    <div className="manager-layout">
      <section className="manager-list">
        <header><strong>课程章节</strong><button className="icon-button" type="button" title="刷新章节" onClick={load}><RefreshCw size={17} /></button></header>
        {loading ? <p className="manager-empty">正在加载章节...</p> : chapters.length === 0 ? <p className="manager-empty">暂无章节，请在右侧创建。</p> : chapters.map((chapter) => <article className={editing?.id === chapter.id ? "selected" : ""} key={chapter.id}><span><FileText size={17} /></span><div><strong>{chapter.sortOrder}. {chapter.title}</strong><small>{formatTime(chapter.updatedTime)}</small></div><button className="icon-button" type="button" title="编辑章节" onClick={() => edit(chapter)}><Edit3 size={15} /></button><button className="icon-button danger" type="button" title="删除章节" onClick={() => remove(chapter)}><Trash2 size={15} /></button></article>)}
      </section>
      <form className="manager-form" onSubmit={save}>
        <header><div><strong>{editing ? "编辑章节" : "新建章节"}</strong><small>正文按纯文本保存，不执行 HTML。</small></div><button className="button ghost compact" type="button" onClick={create}><Plus size={15} />新建</button></header>
        <label>章节标题<input value={form.title} maxLength={128} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>排序<input type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required /></label>
        <label>章节正文<textarea value={form.content} maxLength={20000} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label>
        <button className="button primary" type="submit" disabled={saving}><Save size={16} />{saving ? "保存中..." : "保存章节"}</button>
      </form>
    </div>
  </Modal>;
}

function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
