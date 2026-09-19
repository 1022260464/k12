import { ArrowLeft, Edit3, FileText, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { coursesApi } from "../api/client.js";
import { RichTextField } from "../components/RichTextField.jsx";

const emptySection = { title: "", content: "", sortOrder: 1 };

export function CourseSectionManager({ course, chapter, notify, onBack }) {
  const [sections, setSections] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySection);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setSections(await coursesApi.sections(course.id, chapter.id)); }
    catch (error) { notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [course.id, chapter.id]);

  function create() {
    setEditing(null);
    setForm({ ...emptySection, sortOrder: sections.length + 1 });
  }

  async function edit(section) {
    try {
      const detail = await coursesApi.section(course.id, chapter.id, section.id);
      setEditing(detail);
      setForm({ title: detail.title, content: detail.content, sortOrder: detail.sortOrder });
    } catch (error) { notify(error.message, "error"); }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, sortOrder: Number(form.sortOrder) };
      if (editing) await coursesApi.updateSection(course.id, chapter.id, editing.id, payload);
      else await coursesApi.createSection(course.id, chapter.id, payload);
      notify(editing ? "小节已更新" : "小节已创建");
      create();
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function remove(section) {
    if (!window.confirm(`确认删除小节“${section.title}”吗？`)) return;
    try { await coursesApi.removeSection(course.id, chapter.id, section.id); notify("小节已删除"); create(); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  return <>
    <div className="manager-back"><button className="button ghost compact" type="button" onClick={onBack}><ArrowLeft size={15} />返回章节</button><strong>{chapter.title} / 小节</strong></div>
    <div className="manager-layout section-manager">
      <section className="manager-list">
        <header><strong>小节目录</strong><button className="icon-button" type="button" title="刷新小节" onClick={load}><RefreshCw size={17} /></button></header>
        {loading ? <p className="manager-empty">正在加载小节...</p> : sections.length === 0 ? <p className="manager-empty">暂无小节，请在右侧创建。</p> : sections.map((section) => <article className={editing?.id === section.id ? "selected" : ""} key={section.id}><span><FileText size={17} /></span><div><strong>{section.sortOrder}. {section.title}</strong></div><button className="icon-button" type="button" title="编辑小节" onClick={() => edit(section)}><Edit3 size={15} /></button><button className="icon-button danger" type="button" title="删除小节" onClick={() => remove(section)}><Trash2 size={15} /></button></article>)}
      </section>
      <form className="manager-form" onSubmit={save}>
        <header><div><strong>{editing ? "编辑小节" : "新建小节"}</strong><small>正文支持加粗、下划线、列表、插图等富文本。</small></div><button className="button ghost compact" type="button" onClick={create}><Plus size={15} />新建</button></header>
        <label>小节标题<input value={form.title} maxLength={128} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>排序<input type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required /></label>
        <RichTextField
          label="教学内容"
          value={form.content}
          required
          resetKey={editing?.id ? `section-${editing.id}` : "section-new"}
          onChange={(content) => setForm({ ...form, content })}
          onUploadImage={(file) => coursesApi.uploadContentImage(course.id, file)}
        />
        <button className="button primary" type="submit" disabled={saving}><Save size={16} />{saving ? "保存中..." : "保存小节"}</button>
      </form>
    </div>
  </>;
}
