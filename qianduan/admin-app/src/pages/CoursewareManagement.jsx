import { CheckCircle2, LoaderCircle, Presentation, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { coursewareApi } from "../api/client.js";
import { CoursewarePreview } from "../components/CoursewarePreview.jsx";

const STAGE_OPTIONS = [
  ["lower_primary", "小学低年级"],
  ["upper_primary", "小学高年级"],
  ["middle_school", "初中"],
  ["high_school", "高中"],
];

const STAGE_LABELS = Object.fromEntries(STAGE_OPTIONS);

/** AI 课件管理：生成草稿 → 预览审核 → 发布到学生端。 */
export function CoursewareManagement({ notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ topic: "", stage: "lower_primary", slideCount: 6, topicCode: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await coursewareApi.list());
    } catch (err) {
      setError(err.message || "课件列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function generate(event) {
    event.preventDefault();
    if (!form.topic.trim() || generating) return;
    setGenerating(true);
    setError("");
    try {
      const created = await coursewareApi.generate({
        topic: form.topic.trim(),
        stage: form.stage,
        slideCount: Number(form.slideCount),
        topicCode: form.topicCode.trim() || undefined,
      });
      notify(`课件《${created.title}》已生成，请预览后发布`);
      setForm({ topic: "", stage: form.stage, slideCount: form.slideCount, topicCode: "" });
      setPreview(created);
      await load();
    } catch (err) {
      setError(err.message || "课件生成失败，请稍后再试");
      notify(err.message || "课件生成失败", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function togglePublish(item) {
    try {
      await coursewareApi[item.status === "PUBLISHED" ? "unpublish" : "publish"](item.coursewareId);
      notify(item.status === "PUBLISHED" ? "已下架，学生端不再可见" : "已发布，学生端现在可以看到啦");
      await load();
      setPreview((current) => (current?.coursewareId === item.coursewareId
        ? { ...current, status: item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }
        : current));
    } catch (err) {
      notify(err.message || "操作失败", "error");
    }
  }

  const publishedCount = items.filter((item) => item.status === "PUBLISHED").length;

  return (
    <section className="page-section courseware-admin">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AI COURSEWARE STUDIO</p>
          <h1>AI 课件生成</h1>
          <p>输入知识点自动生成互动课件，预览审核后发布到学生端「AI 课件」书架。</p>
        </div>
      </header>

      <form className="data-panel courseware-form" onSubmit={generate}>
        <div className="table-toolbar"><strong>生成新课件</strong><span className="courseware-form-hint">大模型生成约需 10-30 秒</span></div>
        <div className="courseware-form-grid">
          <label>课件主题 *
            <input
              value={form.topic}
              maxLength={200}
              required
              placeholder="例如：认识人工智能、植物的一生"
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </label>
          <label>学段
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {STAGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>页数
            <select value={form.slideCount} onChange={(e) => setForm({ ...form, slideCount: e.target.value })}>
              {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} 页</option>)}
            </select>
          </label>
          <label>知识点编码（可选）
            <input
              value={form.topicCode}
              maxLength={120}
              placeholder="关联知识图谱编码，如 image-classification"
              onChange={(e) => setForm({ ...form, topicCode: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="table-error">{error}</p>}
        <div className="courseware-form-actions">
          <button className="button primary" type="submit" disabled={generating || !form.topic.trim()}>
            {generating ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
            {generating ? "正在生成课件..." : "生成课件"}
          </button>
        </div>
      </form>

      <div className="data-panel">
        <div className="table-toolbar">
          <strong>课件库（{items.length}） · 已发布 {publishedCount}</strong>
          <button className="icon-button" type="button" title="刷新" onClick={load}><RefreshCw size={18} /></button>
        </div>
        {loading ? <div className="admin-empty"><LoaderCircle className="spin" />正在加载…</div>
          : items.length === 0 ? <div className="admin-empty">还没有课件，先用上面的表单生成一份吧。</div>
            : (
              <div className="table-wrap">
                <table className="responsive-table">
                  <thead>
                    <tr><th>课件</th><th>学段</th><th>页数</th><th>状态</th><th>创建人</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.coursewareId}>
                        <td data-label="课件">
                          <strong>{item.title}</strong>
                          <small className="table-sub">{item.coursewareId}</small>
                        </td>
                        <td data-label="学段">{STAGE_LABELS[item.stage] || item.stage}</td>
                        <td data-label="页数">{item.slideCount}</td>
                        <td data-label="状态">
                          <span className={`status ${item.status === "PUBLISHED" ? "enabled" : "locked"}`}>
                            {item.status === "PUBLISHED" ? "已发布" : "草稿"}
                          </span>
                        </td>
                        <td data-label="创建人">{item.createdBy || "-"}</td>
                        <td data-label="操作" className="table-actions">
                          <button className="button" type="button" onClick={() => setPreview(item)}>
                            <Presentation size={14} />预览
                          </button>
                          {item.status === "PUBLISHED"
                            ? <button className="danger" type="button" onClick={() => togglePublish(item)}>下架</button>
                            : <button className="button primary" type="button" onClick={() => togglePublish(item)}>
                              <CheckCircle2 size={14} />发布
                            </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      {preview && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="modal courseware-preview-modal">
            <header className="modal-header">
              <h2><Presentation size={18} /> {preview.title}</h2>
              <div className="courseware-preview-actions">
                <button
                  className={preview.status === "PUBLISHED" ? "button danger" : "button primary"}
                  type="button"
                  onClick={() => togglePublish(preview)}
                >
                  {preview.status === "PUBLISHED" ? "下架" : "发布到学生端"}
                </button>
                <button className="icon-button" type="button" title="关闭" onClick={() => setPreview(null)}><X size={19} /></button>
              </div>
            </header>
            <CoursewarePreview document={preview.document} />
          </div>
        </div>
      )}
    </section>
  );
}
