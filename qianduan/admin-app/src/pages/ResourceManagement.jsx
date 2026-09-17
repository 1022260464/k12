import { Bot, BookOpen, Edit3, Layers3, ListTree, Play, Plus, RefreshCw, Search, Send, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { agentsApi, coursesApi, homeworksApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { AgentRunManager } from "./AgentRunManager.jsx";
import { CourseChapterManager } from "./CourseChapterManager.jsx";
import { HomeworkDetailManager } from "./HomeworkDetailManager.jsx";

const configs = {
  courses: { title: "课程资源", entityName: "课程", eyebrow: "LEARNING CATALOG", description: "维护课程基础信息、封面对象键、章节顺序和教学正文。", api: coursesApi, icon: BookOpen, fields: [["title", "课程标题"], ["subject", "学科"], ["gradeLevel", "年级"], ["coverObjectKey", "封面对象键"], ["description", "课程描述", "textarea"]], initial: { title: "", subject: "", gradeLevel: "", coverObjectKey: "", description: "" }, columns: [["subject", "学科"], ["gradeLevel", "年级"]] },
  agents: { title: "智能体管理", entityName: "智能体", eyebrow: "AGENT CATALOG", description: "维护智能体配置，执行连通性测试并跟踪运行记录与产物。", api: agentsApi, icon: Bot, fields: [["code", "智能体编码"], ["name", "智能体名称"], ["type", "类型"], ["description", "智能体描述", "textarea"]], initial: { code: "", name: "", type: "", description: "" }, columns: [["code", "编码"], ["type", "类型"]] },
  homeworks: { title: "作业管理", entityName: "作业", eyebrow: "ASSESSMENT", description: "创建作业，配置接收人和题目，并完成发布、关闭与批改。", api: homeworksApi, icon: BookOpen, fields: [["courseId", "所属课程", "number"], ["title", "作业标题"], ["description", "作业说明", "textarea"]], initial: { courseId: "", title: "", description: "", status: "DRAFT" }, columns: [["courseId", "课程 ID"], ["status", "状态"]] },
};

export function ResourceManagement({ resource, notify }) {
  const config = configs[resource];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [workspaceItem, setWorkspaceItem] = useState(null);
  const [runCenterOpen, setRunCenterOpen] = useState(false);
  const [form, setForm] = useState(config.initial);
  const [courseOptions, setCourseOptions] = useState([]);

  async function load() {
    setLoading(true);
    setLoadError("");
    try { setItems(await config.api.list()); }
    catch (error) { setLoadError(error.message); notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    setItems([]);
    setEditing(undefined);
    setWorkspaceItem(null);
    setQuery("");
    load();
    if (resource === "homeworks") {
      coursesApi.list().then(setCourseOptions).catch((error) => notify(error.message, "error"));
    }
  }, [resource]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => [item.title, item.name, item.code, item.subject, item.gradeLevel, item.type, item.status, item.description]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [items, query]);

  async function openForm(item = null) {
    if (!item) {
      setEditing(null);
      setForm({ ...config.initial });
      return;
    }
    setDetailLoadingId(item.id);
    try {
      const detail = await config.api.get(item.id);
      setEditing(detail);
      setForm(Object.fromEntries(Object.keys(config.initial).map((key) => [key, detail[key] ?? config.initial[key]])));
    } catch (error) {
      notify(`详情加载失败：${error.message}`, "error");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function openWorkspace(item) {
    setDetailLoadingId(item.id);
    try {
      setWorkspaceItem(await config.api.get(item.id));
    } catch (error) {
      notify(`详情加载失败：${error.message}`, "error");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function save(event) {
    event.preventDefault();
    const payload = resource === "homeworks" ? { ...form, courseId: Number(form.courseId), status: "DRAFT" } : form;
    try {
      if (editing) await config.api.update(editing.id, payload);
      else await config.api.create(payload);
      setEditing(undefined);
      notify(editing ? "资料已更新" : "记录已创建");
      await load();
    } catch (error) { notify(error.message, "error"); }
  }

  async function remove() {
    try { await config.api.remove(deleting.id); setDeleting(null); notify("记录已删除"); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  async function transition(item, action) {
    try { await homeworksApi[action](item.id); notify(action === "publish" ? "作业已发布" : "作业已关闭"); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  async function testAgent(item) {
    try {
      await agentsApi.run(item.code, { inputText: "管理端连通性测试", sessionId: `admin-${Date.now()}`, executionMode: "SYNC", context: { source: "admin" } });
      notify("智能体测试运行完成");
    } catch (error) { notify(error.message, "error"); }
  }

  const Icon = config.icon;
  return <section className="page-section">
    <header className="page-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p>{config.description}</p></div><div className="page-actions">{resource === "agents" && <button className="button ghost" type="button" onClick={() => setRunCenterOpen(true)}><Layers3 size={17} />运行中心</button>}<button className="button primary" type="button" onClick={() => openForm()}><Plus size={18} />新建</button></div></header>
    <div className="data-panel"><div className="table-toolbar"><label className="search-control"><Search size={17} /><input value={query} placeholder={`搜索${config.title}`} onChange={(event) => setQuery(event.target.value)} /></label><span className="toolbar-title"><Icon size={18} />{filteredItems.length} / {items.length} 条</span><button className="icon-button" type="button" title="刷新" onClick={load}><RefreshCw size={18} /></button></div><div className="table-wrap"><table className="responsive-table"><thead><tr><th>名称</th>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>更新时间</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>
      {loading ? <tr><td colSpan="6" className="empty-cell">正在加载...</td></tr> : loadError ? <tr><td colSpan="6" className="empty-cell table-error">加载失败：{loadError}。请点击刷新重试。</td></tr> : !filteredItems.length ? <tr><td colSpan="6" className="empty-cell">{items.length ? "没有匹配的记录" : "暂无数据"}</td></tr> : filteredItems.map((item) => <tr key={item.id}><td data-label="名称"><strong className="table-primary-text">{item.title || item.name}</strong><small className="table-description">{item.description || "未填写说明"}</small></td>{config.columns.map(([key, label]) => <td data-label={label} key={key}>{key === "status" ? <span className={`status ${statusClass(item[key])}`}>{statusLabel(item[key])}</span> : item[key] ?? "-"}</td>)}<td data-label="更新时间">{formatTime(item.updatedTime)}</td><td data-label="操作"><div className="row-actions">
        {resource !== "agents" && <button className="icon-button" type="button" title={resource === "courses" ? "管理章节" : "作业工作台"} disabled={detailLoadingId === item.id} onClick={() => openWorkspace(item)}><ListTree size={16} /></button>}
        {resource === "homeworks" && item.status === "DRAFT" && <button className="icon-button" type="button" title="发布" onClick={() => transition(item, "publish")}><Send size={16} /></button>}
        {resource === "homeworks" && item.status === "PUBLISHED" && <button className="icon-button" type="button" title="关闭" onClick={() => transition(item, "close")}><XCircle size={16} /></button>}
        {resource === "agents" && <button className="icon-button" type="button" title="运行测试" onClick={() => testAgent(item)}><Play size={16} /></button>}
        <button className="icon-button" type="button" title="编辑" disabled={detailLoadingId === item.id || (resource === "homeworks" && item.status !== "DRAFT")} onClick={() => openForm(item)}><Edit3 size={16} /></button>
        <button className="icon-button danger" type="button" title="删除" onClick={() => setDeleting(item)}><Trash2 size={16} /></button>
      </div></td></tr>)}
    </tbody></table></div></div>
    {editing !== undefined && <Modal title={editing ? `编辑${config.entityName}` : `新建${config.entityName}`} description={resource === "courses" ? "封面请填写 course-assets/ 下的MinIO对象键；留空时用户端显示默认插画。" : "表单会先读取后端详情，保存后立即刷新列表。"} onClose={() => setEditing(undefined)}><form className="resource-form" onSubmit={save}>{config.fields.map(([key, label, type]) => <label key={key}>{label}{resource === "homeworks" && key === "courseId" ? <select value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required><option value="">请选择课程</option>{courseOptions.map((course) => <option value={course.id} key={course.id}>{course.title}（#{course.id}）</option>)}</select> : type === "textarea" ? <textarea value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <input type={type || "text"} value={form[key]} placeholder={key === "coverObjectKey" ? "course-assets/v1/example.png" : undefined} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required={!['description', 'coverObjectKey'].includes(key)} />}</label>)}<div><button className="button ghost" type="button" onClick={() => setEditing(undefined)}>取消</button><button className="button primary" type="submit">保存</button></div></form></Modal>}
    {deleting && <Modal title="确认删除记录" description={`即将删除“${deleting.title || deleting.name}”，关联数据可能阻止该操作。`} onClose={() => setDeleting(null)} width={460}><div className="confirm-actions"><button className="button ghost" type="button" onClick={() => setDeleting(null)}>取消</button><button className="button danger-solid" type="button" onClick={remove}>确认删除</button></div></Modal>}
    {resource === "courses" && workspaceItem && <CourseChapterManager course={workspaceItem} notify={notify} onClose={() => setWorkspaceItem(null)} />}
    {resource === "homeworks" && workspaceItem && <HomeworkDetailManager homework={workspaceItem} notify={notify} onClose={() => setWorkspaceItem(null)} />}
    {resource === "agents" && runCenterOpen && <AgentRunManager notify={notify} onClose={() => setRunCenterOpen(false)} />}
  </section>;
}

function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "-"; }
function statusLabel(status) { return ({ DRAFT: "草稿", PUBLISHED: "已发布", CLOSED: "已关闭", ENABLED: "启用", DISABLED: "停用" })[status] || status || "-"; }
function statusClass(status) { return status === "DRAFT" ? "pending" : ["CLOSED", "DISABLED"].includes(status) ? "disabled" : "enabled"; }
