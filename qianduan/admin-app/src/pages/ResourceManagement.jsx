import { Bot, BookOpen, ClipboardCheck, Edit3, FileUp, Layers3, ListTree, Play, Plus, RefreshCw, Search, Send, Trash2, Upload, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { agentsApi, coursesApi, homeworksApi } from "../api/client.js";
import { ExpandableTextarea } from "../components/MarkdownField.jsx";
import { Modal } from "../components/Modal.jsx";
import { AgentRunManager } from "./AgentRunManager.jsx";
import { CourseChapterManager } from "./CourseChapterManager.jsx";
import { HomeworkDetailManager } from "./HomeworkDetailManager.jsx";

const configs = {
  courses: {
    title: "课程资源", entityName: "课程", eyebrow: "LEARNING CATALOG",
    description: "推荐用 JSON 批量导入课程结构；封面用图片上传。创建后补章节再发布。",
    api: coursesApi, icon: BookOpen,
    columns: [["subject", "学科"], ["gradeLevel", "年级"], ["status", "状态"]],
  },
  agents: {
    title: "智能体管理", entityName: "智能体", eyebrow: "AGENT CATALOG",
    description: "维护智能体配置，执行连通性测试并跟踪运行记录与产物。",
    api: agentsApi, icon: Bot,
    fields: [["code", "智能体编码"], ["name", "智能体名称"], ["type", "类型"], ["description", "智能体描述", "textarea"]],
    initial: { code: "", name: "", type: "", description: "" },
    columns: [["code", "编码"], ["type", "类型"]],
  },
  homeworks: {
    title: "作业管理", entityName: "作业", eyebrow: "ASSESSMENT",
    description: "先建草稿作业，进入工作台批量导入题目、上传附件并选择接收人后发布。",
    api: homeworksApi, icon: ClipboardCheck,
    columns: [["courseTitle", "所属课程"], ["status", "状态"]],
  },
};

export function ResourceManagement({ resource, isAdmin, notify }) {
  const config = configs[resource];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(undefined);
  const [deleting, setDeleting] = useState(null);
  const [workspaceItem, setWorkspaceItem] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState(null);
  const [runCenterOpen, setRunCenterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", subject: "", gradeLevel: "", description: "" });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverBroken, setCoverBroken] = useState(false);
  const coverBlobRef = useRef(null);
  const [homeworkForm, setHomeworkForm] = useState({ courseId: "", title: "", description: "" });
  const [agentForm, setAgentForm] = useState(configs.agents.initial);
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseMap, setCourseMap] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      if (resource === "courses" && !isAdmin) {
        const result = await coursesApi.page({ page: 1, size: 100, mine: true });
        setItems(result.items || []);
      } else setItems(await config.api.list());
    } catch (error) { setLoadError(error.message); notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    setItems([]);
    setEditing(undefined);
    setWorkspaceItem(null);
    setWorkspaceTab(null);
    setQuery("");
    revokeCoverBlob();
    setCoverFile(null);
    setCoverPreview("");
    setCoverBroken(false);
    load();
    if (resource === "homeworks" || resource === "courses") {
      (isAdmin ? coursesApi.list() : coursesApi.page({ page: 1, size: 100, mine: true }).then((result) => result.items))
        .then((courses) => {
          const list = courses || [];
          setCourseOptions(list.filter((course) => course.status === 1));
          setCourseMap(Object.fromEntries(list.map((course) => [course.id, course.title])));
        })
        .catch((error) => notify(error.message, "error"));
    }
  }, [resource, isAdmin]);

  useEffect(() => () => {
    if (coverBlobRef.current) {
      URL.revokeObjectURL(coverBlobRef.current);
      coverBlobRef.current = null;
    }
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const enriched = items.map((item) => resource === "homeworks"
      ? { ...item, courseTitle: courseMap[item.courseId] || `课程 #${item.courseId}` }
      : item);
    if (!keyword) return enriched;
    return enriched.filter((item) => [item.title, item.name, item.code, item.subject, item.gradeLevel, item.type, item.status, item.description, item.courseTitle]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [items, query, resource, courseMap]);

  function revokeCoverBlob() {
    if (coverBlobRef.current) {
      URL.revokeObjectURL(coverBlobRef.current);
      coverBlobRef.current = null;
    }
  }

  function pickCover(file, remoteUrl = "") {
    revokeCoverBlob();
    setCoverBroken(false);
    if (file) {
      const url = URL.createObjectURL(file);
      coverBlobRef.current = url;
      setCoverFile(file);
      setCoverPreview(url);
      return;
    }
    setCoverFile(null);
    setCoverPreview(remoteUrl || "");
  }

  async function openForm(item = null) {
    if (!item) {
      setEditing(null);
      setCourseForm({ title: "", subject: "", gradeLevel: "", description: "" });
      setHomeworkForm({ courseId: "", title: "", description: "" });
      setAgentForm({ ...configs.agents.initial });
      pickCover(null);
      return;
    }
    setDetailLoadingId(item.id);
    try {
      const detail = await config.api.get(item.id);
      setEditing(detail);
      if (resource === "courses") {
        setCourseForm({ title: detail.title || "", subject: detail.subject || "", gradeLevel: detail.gradeLevel || "", description: detail.description || "" });
        pickCover(null, detail.coverUrl || "");
      } else if (resource === "homeworks") {
        setHomeworkForm({ courseId: detail.courseId || "", title: detail.title || "", description: detail.description || "" });
      } else {
        setAgentForm(Object.fromEntries(Object.keys(configs.agents.initial).map((key) => [key, detail[key] ?? ""])));
      }
    } catch (error) {
      notify(`详情加载失败：${error.message}`, "error");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function openWorkspace(item, tab = null) {
    setDetailLoadingId(item.id);
    try {
      setWorkspaceTab(tab);
      setWorkspaceItem(await config.api.get(item.id));
    } catch (error) {
      notify(`详情加载失败：${error.message}`, "error");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function saveCourse(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...courseForm, coverObjectKey: editing?.coverObjectKey || null };
      let saved;
      if (editing) {
        saved = await coursesApi.update(editing.id, payload);
        if (coverFile) saved = await coursesApi.uploadCover(editing.id, coverFile);
        notify("课程已更新");
      } else {
        saved = await coursesApi.create(payload);
        if (coverFile) saved = await coursesApi.uploadCover(saved.id, coverFile);
        notify("草稿课程已创建，请继续维护章节或导入内容");
      }
      setEditing(undefined);
      pickCover(null);
      await load();
      if (!editing && saved) openWorkspace(saved);
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function saveHomework(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...homeworkForm, courseId: Number(homeworkForm.courseId), status: "DRAFT" };
      let saved;
      if (editing) {
        saved = await homeworksApi.update(editing.id, payload);
        notify("作业已更新");
        setEditing(undefined);
      } else {
        saved = await homeworksApi.create(payload);
        notify("草稿作业已创建，请批量导入题目");
        setEditing(undefined);
        await load();
        openWorkspace(saved, "questions");
        return;
      }
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function saveAgent(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) await agentsApi.update(editing.id, agentForm);
      else await agentsApi.create(agentForm);
      setEditing(undefined);
      notify(editing ? "资料已更新" : "记录已创建");
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  async function remove() {
    try { await config.api.remove(deleting.id); setDeleting(null); notify("记录已删除"); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  async function transition(item, action) {
    try { await (resource === "courses" ? coursesApi[action](item.id) : homeworksApi[action](item.id)); notify(action === "publish" ? "已发布" : "作业已关闭"); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  async function testAgent(item) {
    try {
      await agentsApi.run(item.code, { inputText: "管理端连通性测试", sessionId: `admin-${Date.now()}`, executionMode: "SYNC", context: { source: "admin" } });
      notify("智能体测试运行完成");
    } catch (error) { notify(error.message, "error"); }
  }

  async function importCourses(event) {
    event.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const result = await coursesApi.importBatch(importFile);
      notify(`已导入 ${result.length} 门草稿课程，可继续上传封面并维护章节`);
      setImportOpen(false);
      setImportFile(null);
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setImporting(false); }
  }

  const Icon = config.icon;
  const emptyHint = resource === "courses"
    ? "还没有课程。优先下载模板批量导入，或手工新建后管理章节。"
    : resource === "homeworks"
      ? "还没有作业。新建草稿后会自动打开工作台，可批量导入题目与上传附件。"
      : "暂无数据";

  return <section className="page-section">
    <header className="page-heading">
      <div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p>{config.description}</p></div>
      <div className="page-actions">
        {resource === "agents" && <button className="button ghost" type="button" onClick={() => setRunCenterOpen(true)}><Layers3 size={17} />运行中心</button>}
        {resource === "courses" && <button className="button primary" type="button" onClick={() => setImportOpen(true)}><FileUp size={17} />从 JSON 导入</button>}
        {resource === "courses" && <button className="button ghost" type="button" onClick={() => openForm()}><Plus size={18} />手工新建</button>}
        {resource === "homeworks" && <button className="button primary" type="button" onClick={() => openForm()}><Plus size={18} />新建作业草稿</button>}
        {resource === "agents" && <button className="button primary" type="button" onClick={() => openForm()}><Plus size={18} />新建</button>}
      </div>
    </header>

    {resource === "courses" && !loading && !items.length && (
      <div className="create-path-cards">
        <button className="create-path-card preferred" type="button" onClick={() => setImportOpen(true)}>
          <FileUp size={22} /><strong>推荐：JSON 批量导入</strong><span>一次写入课程、章节与小节，失败整批回滚。</span>
        </button>
        <button className="create-path-card" type="button" onClick={() => openForm()}>
          <Plus size={22} /><strong>手工新建草稿</strong><span>适合单门微调；保存后进入章节管理。</span>
        </button>
      </div>
    )}

    {resource === "homeworks" && !loading && !items.length && (
      <div className="create-path-cards">
        <button className="create-path-card preferred" type="button" onClick={() => openForm()}>
          <ClipboardCheck size={22} /><strong>新建作业草稿</strong><span>创建后自动进入题目工作台，支持模板批量导入与附件上传。</span>
        </button>
      </div>
    )}

    <div className="data-panel"><div className="table-toolbar"><label className="search-control"><Search size={17} /><input value={query} placeholder={`搜索${config.title}`} onChange={(event) => setQuery(event.target.value)} /></label><span className="toolbar-title"><Icon size={18} />{filteredItems.length} / {items.length} 条</span><button className="icon-button" type="button" title="刷新" onClick={load}><RefreshCw size={18} /></button></div><div className="table-wrap"><table className="responsive-table"><thead><tr><th>名称</th>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th>更新时间</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>
      {loading ? <tr><td colSpan="6" className="empty-cell">正在加载...</td></tr> : loadError ? <tr><td colSpan="6" className="empty-cell table-error">加载失败：{loadError}。请点击刷新重试。</td></tr> : !filteredItems.length ? <tr><td colSpan="6" className="empty-cell">{items.length ? "没有匹配的记录" : emptyHint}</td></tr> : filteredItems.map((item) => <tr key={item.id}><td data-label="名称"><div className="resource-name-cell">{resource === "courses" && item.coverUrl && <img className="course-cover-thumb" src={item.coverUrl} alt="" />}<div><strong className="table-primary-text">{item.title || item.name}</strong><small className="table-description">{item.description || "未填写说明"}</small></div></div></td>{config.columns.map(([key, label]) => <td data-label={label} key={key}>{key === "status" ? <span className={`status ${statusClass(item[key])}`}>{statusLabel(item[key])}</span> : item[key] ?? "-"}</td>)}<td data-label="更新时间">{formatTime(item.updatedTime)}</td><td data-label="操作"><div className="row-actions">
        {resource !== "agents" && <button className="icon-button" type="button" title={resource === "courses" ? "管理章节与附件" : "作业工作台"} disabled={detailLoadingId === item.id} onClick={() => openWorkspace(item, resource === "homeworks" ? "questions" : null)}><ListTree size={16} /></button>}
        {resource === "courses" && item.status === 0 && <button className="icon-button" type="button" title="发布课程" onClick={() => transition(item, "publish")}><Send size={16} /></button>}
        {resource === "homeworks" && item.status === "DRAFT" && <button className="icon-button" type="button" title="发布" onClick={() => transition(item, "publish")}><Send size={16} /></button>}
        {resource === "homeworks" && item.status === "PUBLISHED" && <button className="icon-button" type="button" title="关闭" onClick={() => transition(item, "close")}><XCircle size={16} /></button>}
        {resource === "agents" && <button className="icon-button" type="button" title="运行测试" onClick={() => testAgent(item)}><Play size={16} /></button>}
        <button className="icon-button" type="button" title="编辑" disabled={detailLoadingId === item.id || (resource === "homeworks" && item.status !== "DRAFT")} onClick={() => openForm(item)}><Edit3 size={16} /></button>
        <button className="icon-button danger" type="button" title="删除" onClick={() => setDeleting(item)}><Trash2 size={16} /></button>
      </div></td></tr>)}
    </tbody></table></div></div>

    {editing !== undefined && resource === "courses" && <Modal title={editing ? "编辑课程" : "手工新建课程"} description="基础信息保存后可上传封面；章节内容请用「管理章节」或 JSON 导入。" onClose={() => setEditing(undefined)} width={680}>
      <form className="resource-form material-form" onSubmit={saveCourse}>
        <section className="form-section">
          <h3>基础信息</h3>
          <label>课程标题<input value={courseForm.title} maxLength={128} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required /></label>
          <div className="field-pair"><label>学科<input value={courseForm.subject} maxLength={64} onChange={(event) => setCourseForm({ ...courseForm, subject: event.target.value })} required /></label><label>年级<input value={courseForm.gradeLevel} maxLength={32} onChange={(event) => setCourseForm({ ...courseForm, gradeLevel: event.target.value })} required /></label></div>
          <ExpandableTextarea
            label="课程描述"
            value={courseForm.description}
            maxLength={1000}
            onChange={(description) => setCourseForm({ ...courseForm, description })}
          />
        </section>
        <section className="form-section">
          <h3>课程封面</h3>
          <div className="cover-upload-field">
            <div className="cover-upload-row">
              <div className="cover-preview-box">
                {coverPreview && !coverBroken ? (
                  <img
                    src={coverPreview}
                    alt="封面预览"
                    onError={() => setCoverBroken(true)}
                    onLoad={() => setCoverBroken(false)}
                  />
                ) : (
                  <span>{coverPreview ? "封面无法加载" : "未上传"}</span>
                )}
              </div>
              <div className="cover-upload-copy">
                <label className="file-drop">
                  <Upload size={18} />
                  <span>{coverFile ? coverFile.name : "点击选择封面图片"}</span>
                  <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => pickCover(event.target.files?.[0] || null, editing?.coverUrl || "")} />
                </label>
                <small>支持 PNG / JPG / WEBP，最大 5 MB。直接选文件，无需填写对象键。</small>
                {coverFile && <button className="button ghost compact" type="button" onClick={() => pickCover(null, editing?.coverUrl || "")}>清除本次选择</button>}
              </div>
            </div>
          </div>
        </section>
        <div className="form-actions"><button className="button ghost" type="button" onClick={() => setEditing(undefined)}>取消</button><button className="button primary" type="submit" disabled={saving}>{saving ? "保存中..." : editing ? "保存" : "创建并管理章节"}</button></div>
      </form>
    </Modal>}

    {editing !== undefined && resource === "homeworks" && <Modal title={editing ? "编辑作业草稿" : "新建作业草稿"} description="保存后将进入工作台：优先下载题目模板批量导入，再上传附件并选择接收人。" onClose={() => setEditing(undefined)} width={680}>
      <form className="resource-form material-form" onSubmit={saveHomework}>
        <section className="form-section">
          <h3>关联课程</h3>
          <div className="course-pick-grid">
            {courseOptions.length === 0 ? <p className="binding-empty">暂无已发布课程，请先发布课程后再建作业</p> : courseOptions.map((course) => {
              const selected = String(homeworkForm.courseId) === String(course.id);
              return (
                <button
                  key={course.id}
                  type="button"
                  className={`course-pick-card${selected ? " selected" : ""}`}
                  onClick={() => setHomeworkForm({ ...homeworkForm, courseId: String(course.id) })}
                >
                  <strong>{course.title}</strong>
                  <small>{course.subject || "-"}{course.gradeLevel ? ` · ${course.gradeLevel}` : ""}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="form-section">
          <h3>作业信息</h3>
          <label>作业标题<input value={homeworkForm.title} maxLength={128} onChange={(event) => setHomeworkForm({ ...homeworkForm, title: event.target.value })} required /></label>
          <ExpandableTextarea
            label="作业说明"
            value={homeworkForm.description}
            maxLength={1000}
            onChange={(description) => setHomeworkForm({ ...homeworkForm, description })}
          />
        </section>
        <div className="form-actions"><button className="button ghost" type="button" onClick={() => setEditing(undefined)}>取消</button><button className="button primary" type="submit" disabled={saving || !homeworkForm.courseId}>{saving ? "保存中..." : editing ? "保存" : "创建并导入题目"}</button></div>
      </form>
    </Modal>}

    {editing !== undefined && resource === "agents" && <Modal title={editing ? "编辑智能体" : "新建智能体"} onClose={() => setEditing(undefined)}>
      <form className="resource-form" onSubmit={saveAgent}>
        {configs.agents.fields.map(([key, label, type]) => <label key={key}>{label}{type === "textarea" ? <textarea value={agentForm[key]} onChange={(event) => setAgentForm({ ...agentForm, [key]: event.target.value })} /> : <input value={agentForm[key]} onChange={(event) => setAgentForm({ ...agentForm, [key]: event.target.value })} required={key !== "description"} />}</label>)}
        <div className="form-actions"><button className="button ghost" type="button" onClick={() => setEditing(undefined)}>取消</button><button className="button primary" type="submit" disabled={saving}>保存</button></div>
      </form>
    </Modal>}

    {deleting && <Modal title="确认删除记录" description={`即将删除“${deleting.title || deleting.name}”，关联数据可能阻止该操作。`} onClose={() => setDeleting(null)} width={460}><div className="confirm-actions"><button className="button ghost" type="button" onClick={() => setDeleting(null)}>取消</button><button className="button danger-solid" type="button" onClick={remove}>确认删除</button></div></Modal>}
    {resource === "courses" && workspaceItem && <CourseChapterManager course={workspaceItem} isAdmin={isAdmin} notify={notify} onClose={() => setWorkspaceItem(null)} />}
    {resource === "homeworks" && workspaceItem && <HomeworkDetailManager homework={workspaceItem} notify={notify} initialTab={workspaceTab || "questions"} onClose={() => { setWorkspaceItem(null); setWorkspaceTab(null); }} />}
    {resource === "agents" && runCenterOpen && <AgentRunManager notify={notify} onClose={() => setRunCenterOpen(false)} />}
    {resource === "courses" && importOpen && <Modal title="从 JSON 批量导入课程" description="推荐工程化路径：下载模板 → 填写课程/章/节 → 上传。任一条失败则整批回滚。" onClose={() => setImportOpen(false)} width={600}>
      <form className="resource-form material-form import-panel" onSubmit={importCourses}>
        <section className="form-section">
          <h3>准备模板</h3>
          <a className="button ghost" href="/templates/course-import.json" download><FileUp size={16} />下载课程导入模板</a>
          <ul className="import-hints">
            <li>单文件 ≤ 1 MB，最多 20 门课、每章 ≤ 100 小节、整批 ≤ 500 小节</li>
            <li>导入结果均为草稿；封面请在课程编辑页上传图片</li>
            <li>课程教学附件请到「教学资料」上传并关联课程后送审</li>
          </ul>
        </section>
        <section className="form-section">
          <h3>上传 JSON</h3>
          <label className="file-drop">
            <FileUp size={18} />
            <span>{importFile ? importFile.name : "点击选择 course-import.json"}</span>
            <input type="file" accept=".json,application/json" onChange={(event) => setImportFile(event.target.files?.[0] || null)} required />
          </label>
        </section>
        <div className="form-actions"><button className="button ghost" type="button" onClick={() => setImportOpen(false)}>取消</button><button className="button primary" type="submit" disabled={!importFile || importing}>{importing ? "导入中..." : "开始导入"}</button></div>
      </form>
    </Modal>}
  </section>;
}

function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "-"; }
function statusLabel(status) { return ({ 0: "草稿", 1: "已发布", DRAFT: "草稿", PUBLISHED: "已发布", CLOSED: "已关闭", ENABLED: "启用", DISABLED: "停用" })[status] ?? status ?? "-"; }
function statusClass(status) { return status === 0 || status === "DRAFT" ? "pending" : ["CLOSED", "DISABLED"].includes(status) ? "disabled" : "enabled"; }
