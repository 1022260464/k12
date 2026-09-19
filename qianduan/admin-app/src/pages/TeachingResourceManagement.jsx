import { Check, Database, Download, Edit3, Eye, FileText, GitBranch, Plus, RefreshCw, Search, Send, Undo2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, knowledgeGraphApi, teachingResourcesApi } from "../api/client.js";
import { AiSuggestButton, KnowledgePointPicker } from "../components/KnowledgePointPicker.jsx";
import { Modal } from "../components/Modal.jsx";

const statuses = { DRAFT: "草稿", PENDING_REVIEW: "待审核", APPROVED: "审核通过", REJECTED: "已驳回", PUBLISHED: "已发布", WITHDRAWN: "已撤回" };
const indexStatuses = { NOT_INDEXED: "未入库", INDEXING: "入库中", INDEXED: "已入库", FAILED: "入库失败", UNKNOWN: "结果待确认", DEINDEXING: "撤回中" };
const indexable = (item) => ["pdf", "docx", "pptx"].includes(item.originalFilename?.split(".").pop()?.toLowerCase()) && item.sizeBytes <= 20 * 1024 * 1024;
const retryReady = (item) => item.ragIndexStatus !== "UNKNOWN" || Date.now() - new Date(item.updatedTime).getTime() >= 15 * 60 * 1000;
const emptyForm = { title: "", description: "", stageCode: "", subject: "", sourceNote: "", bindings: [], grade: "", textbook: "", knowledgeCode: "" };
const date = (value) => value ? new Date(value).toLocaleString("zh-CN") : "-";
const STAGE_LABELS = {
  LOW_PRIMARY: "小学低年级",
  HIGH_PRIMARY: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

function localSuggestKnowledge(title, description, points, limit = 5) {
  const hay = `${title || ""} ${description || ""}`.toLowerCase();
  if (!hay.trim() || !points?.length) return [];
  const scored = [];
  for (const point of points) {
    let score = 0;
    const pointTitle = String(point.title || "").toLowerCase();
    const code = String(point.code || "").toLowerCase();
    if (pointTitle && hay.includes(pointTitle)) score += 10;
    for (const token of pointTitle.split(/[\s/、，,；;：:()（）\[\]|-]+/).filter((t) => t.length >= 2)) {
      if (hay.includes(token)) { score += 3; break; }
    }
    if (/python|程序|代码|编程|循环|算法/.test(hay) && /computing\.|algorithm|loop/.test(code)) score += 5;
    if (/数据|隐私/.test(hay) && /data_literacy/.test(code)) score += 4;
    if (/机器学习|监督|分类|特征|标签|训练/.test(hay) && /machine_learning/.test(code)) score += 5;
    if (/ai|智能|模型|提示|生成|幻觉/.test(hay) && /generative_ai|machine_learning/.test(code)) score += 4;
    if (score > 0) scored.push({ code: point.code, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, limit).map((item) => item.code);
}

function stageCodeFromCourse(course) {
  const text = String(course?.gradeLevel || "").trim().toLowerCase();
  if (!text) return "";
  if (/高中|高一|高二|高三|senior/.test(text)) return "SENIOR_HIGH";
  if (/初中|初一|初二|初三|七年级|八年级|九年级|junior|middle/.test(text)) return "JUNIOR_HIGH";
  if (/小学高|高年级|四|五|六|high.?primary|upper.?primary/.test(text)) return "HIGH_PRIMARY";
  if (/小学低|低年级|一|二|三|low.?primary|lower.?primary|小学/.test(text)) return "LOW_PRIMARY";
  return "";
}
const publishedOnly = (items) => {
  if (!items?.length) return [];
  const hasStatus = items.some((item) => item.status !== undefined && item.status !== null);
  return hasStatus ? items.filter((item) => item.status === 1) : items;
};
const selectedCourseIds = (bindings) => [...new Set((bindings || []).map((item) => item.courseId).filter(Boolean))];
const chaptersForCourse = (bindings, courseId) => (bindings || [])
  .filter((item) => item.courseId === courseId && item.chapterId != null)
  .map((item) => item.chapterId);
const hasCourseOnly = (bindings, courseId) => (bindings || []).some((item) => item.courseId === courseId && item.chapterId == null)
  || ((bindings || []).some((item) => item.courseId === courseId) && chaptersForCourse(bindings, courseId).length === 0);

function hydrateBindings(item) {
  if (item.bindings?.length) {
    return item.bindings.map((binding) => ({
      courseId: binding.courseId,
      chapterId: binding.chapterId ?? null,
    }));
  }
  if (item.courseId) return [{ courseId: item.courseId, chapterId: item.chapterId ?? null }];
  return [];
}

function buildPayload(form) {
  const bindings = (form.bindings || []).map((item) => ({
    courseId: item.courseId,
    chapterId: item.chapterId ?? null,
  }));
  const primary = bindings[0] || null;
  return {
    title: form.title,
    description: form.description,
    stageCode: form.stageCode,
    subject: form.subject,
    sourceNote: form.sourceNote,
    grade: form.grade,
    textbook: form.textbook,
    knowledgeCode: form.knowledgeCode || "",
    bindings,
    courseId: primary?.courseId ?? null,
    chapterId: primary?.chapterId ?? null,
  };
}

function bindingLabel(binding, courses, chaptersByCourse) {
  const course = courses.find((item) => item.id === binding.courseId);
  const courseTitle = course?.title || `课程 #${binding.courseId}`;
  if (binding.chapterId == null) return `${courseTitle}（整课）`;
  const chapter = (chaptersByCourse[binding.courseId] || []).find((item) => item.id === binding.chapterId);
  return `${courseTitle} / ${chapter?.title || `章节 #${binding.chapterId}`}`;
}

export function TeachingResourceManagement({ isAdmin, notify }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [chaptersByCourse, setChaptersByCourse] = useState({});
  const [courseQuery, setCourseQuery] = useState("");
  const [contextError, setContextError] = useState("");
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [aiSuggestedCodes, setAiSuggestedCodes] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState("");

  const courseIds = useMemo(() => selectedCourseIds(form.bindings), [form.bindings]);
  const primaryCourse = courses.find((course) => course.id === courseIds[0]);
  const subjectLocked = Boolean(primaryCourse);
  const gradeLocked = Boolean(primaryCourse?.gradeLevel);
  const stageLocked = Boolean(primaryCourse && stageCodeFromCourse(primaryCourse));

  async function loadKnowledgeCatalog() {
    try {
      const points = await knowledgeGraphApi.points({ limit: 500 });
      setKnowledgePoints(Array.isArray(points) ? points : []);
    } catch {
      setKnowledgePoints([]);
    }
  }

  async function load(targetPage = page, targetStatus = status, targetKeyword = keyword) {
    setLoading(true);
    setError("");
    try {
      const result = await teachingResourcesApi.page({ page: targetPage, size: 20, status: targetStatus, keyword: targetKeyword });
      setItems(result.items || []);
      setHasMore(result.hasMore);
    } catch (cause) {
      setError(cause.message);
      notify(cause.message, "error");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); loadKnowledgeCatalog(); }, []);
  useEffect(() => {
    if (!items.some((item) => ["INDEXING", "DEINDEXING"].includes(item.ragIndexStatus))) return undefined;
    const timer = setTimeout(() => load(page, status, keyword), 5000);
    return () => clearTimeout(timer);
  }, [items, page, status, keyword]);

  useEffect(() => {
    if (!["upload", "edit"].includes(modal?.type)) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      coursesApi.page({ page: 1, size: 100, keyword: courseQuery.trim(), mine: !isAdmin }).then((result) => {
        if (!active) return;
        const next = publishedOnly(result.items || []);
        setCourses((current) => {
          const keep = current.filter((course) => courseIds.includes(course.id) && !next.some((item) => item.id === course.id));
          return [...keep, ...next];
        });
        setContextError("");
      }).catch((cause) => { if (active) setContextError(cause.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [modal?.type, courseQuery, courseIds.join(","), isAdmin]);

  useEffect(() => {
    if (!["upload", "edit"].includes(modal?.type) || !courseIds.length) return undefined;
    let active = true;
    Promise.all(courseIds.map(async (courseId) => {
      try {
        const result = await coursesApi.chapters(courseId);
        return [courseId, result || []];
      } catch (cause) {
        if (active) setContextError(cause.message);
        return [courseId, []];
      }
    })).then((entries) => {
      if (!active) return;
      setChaptersByCourse((current) => {
        const next = { ...current };
        for (const [courseId, chapters] of entries) next[courseId] = chapters;
        return next;
      });
    });
    return () => { active = false; };
  }, [modal?.type, courseIds.join(",")]);

  function changeStatus(value) { setStatus(value); setPage(1); load(1, value, keyword); }
  function search(event) { event.preventDefault(); setKeyword(searchTerm.trim()); setPage(1); load(1, status, searchTerm.trim()); }
  function turnPage(next) { setPage(next); load(next, status, keyword); }

  function openUpload() {
    setForm(emptyForm);
    setFile(null);
    setCourses([]);
    setChaptersByCourse({});
    setCourseQuery("");
    setContextError("");
    setSuggestNote("");
    setPointFilter("");
    setModal({ type: "upload" });
  }

  function openEdit(item) {
    const bindings = hydrateBindings(item);
    const seeded = [];
    if (item.bindings?.length) {
      for (const binding of item.bindings) {
        if (!seeded.some((course) => course.id === binding.courseId)) {
          seeded.push({
            id: binding.courseId,
            title: binding.courseTitle || `原课程 #${binding.courseId}`,
            subject: item.subject,
            gradeLevel: item.grade,
            status: 1,
          });
        }
      }
    } else if (item.courseId) {
      seeded.push({
        id: item.courseId,
        title: `原课程 #${item.courseId}`,
        subject: item.subject,
        gradeLevel: item.grade,
        status: 1,
      });
    }
    setForm({
      title: item.title,
      description: item.description || "",
      stageCode: item.stageCode,
      subject: item.subject,
      sourceNote: item.sourceNote,
      bindings,
      grade: item.grade || "",
      textbook: item.textbook || "",
      knowledgeCode: item.knowledgeCode || "",
    });
    setCourses(seeded);
    setChaptersByCourse({});
    setCourseQuery("");
    setContextError("");
    setModal({ type: "edit", item });
  }

  function syncSubjectGrade(nextBindings, courseList) {
    const firstId = selectedCourseIds(nextBindings)[0];
    const course = courseList.find((item) => item.id === firstId);
    if (!course) return {};
    const stageCode = stageCodeFromCourse(course);
    return {
      subject: course.subject || "",
      grade: course.gradeLevel || "",
      ...(stageCode ? { stageCode } : {}),
    };
  }

  function toggleCourse(course) {
    const selected = courseIds.includes(course.id);
    const nextCourses = courses.some((item) => item.id === course.id) ? courses : [...courses, course];
    if (!courses.some((item) => item.id === course.id)) setCourses(nextCourses);

    setForm((current) => {
      const nextBindings = selected
        ? current.bindings.filter((item) => item.courseId !== course.id)
        : [...current.bindings, { courseId: course.id, chapterId: null }];
      if (!nextBindings.length) return { ...current, bindings: nextBindings };
      return { ...current, bindings: nextBindings, ...syncSubjectGrade(nextBindings, nextCourses) };
    });
  }

  function toggleChapter(courseId, chapterId) {
    setForm((current) => {
      const chapterIds = chaptersForCourse(current.bindings, courseId);
      const selected = chapterIds.includes(chapterId);
      const withoutCourse = current.bindings.filter((item) => item.courseId !== courseId);
      let nextForCourse;
      if (selected) {
        const remaining = chapterIds.filter((id) => id !== chapterId);
        nextForCourse = remaining.length
          ? remaining.map((id) => ({ courseId, chapterId: id }))
          : [{ courseId, chapterId: null }];
      } else {
        nextForCourse = [...chapterIds, chapterId].map((id) => ({ courseId, chapterId: id }));
      }
      return { ...current, bindings: [...withoutCourse, ...nextForCourse] };
    });
  }

  function removeBindingChip(binding) {
    setForm((current) => {
      let nextBindings;
      if (binding.chapterId == null) {
        nextBindings = current.bindings.filter((item) => item.courseId !== binding.courseId);
      } else {
        const without = current.bindings.filter((item) => !(item.courseId === binding.courseId && item.chapterId === binding.chapterId));
        const remainingChapters = chaptersForCourse(without, binding.courseId);
        nextBindings = remainingChapters.length
          ? without
          : [...without.filter((item) => item.courseId !== binding.courseId), { courseId: binding.courseId, chapterId: null }];
      }
      const synced = syncSubjectGrade(nextBindings, courses);
      return { ...current, bindings: nextBindings, ...(nextBindings.length ? synced : {}) };
    });
  }

  function removeCourseChip(courseId) {
    setForm((current) => {
      const nextBindings = current.bindings.filter((item) => item.courseId !== courseId);
      const synced = syncSubjectGrade(nextBindings, courses);
      return { ...current, bindings: nextBindings, ...(nextBindings.length ? synced : {}) };
    });
  }

  async function openDetail(item) {
    try {
      const [detail, history] = await Promise.all([teachingResourcesApi.get(item.id), teachingResourcesApi.events(item.id)]);
      setEvents(history);
      setModal({ type: "detail", item: detail });
    } catch (cause) { notify(cause.message, "error"); }
  }

  async function perform(action, item, message, reviewNote = "") {
    setBusy(true);
    try {
      await teachingResourcesApi[action](item.id, reviewNote);
      setModal(null); setNote("");
      notify(message);
      await load();
    } catch (cause) { notify(cause.message, "error"); }
    finally { setBusy(false); }
  }

  async function suggestKnowledge() {
    if (!String(form.description || "").trim()) {
      notify("请先填写资料简介：简介会写入图谱 description，也是 AI 建议依据", "error");
      return;
    }
    setSuggesting(true);
    try {
      let codes = [];
      try {
        const result = await Promise.race([
          knowledgeGraphApi.suggestCovers({
            title: form.title,
            content: form.description,
            limit: 5,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);
        codes = (result?.suggestions || []).map((item) => item.code).filter(Boolean);
      } catch {
        // local fallback
      }
      if (!codes.length) {
        codes = localSuggestKnowledge(form.title, form.description, knowledgePoints, 8);
      }
      if (!codes.length) {
        notify("暂无匹配建议，请在下方手工勾选主知识点", "error");
        return;
      }
      setForm((current) => ({ ...current, knowledgeCode: codes[0] }));
      setAiSuggestedCodes(codes);
      setSuggestNote(`已建议主知识点并置顶：${codes[0]}${codes.length > 1 ? `（备选 ${codes.length - 1} 个已标 AI）` : ""}`);
      notify("已填入知识点建议，请确认后保存");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSuggesting(false);
    }
  }

  async function syncGraph(item) {
    if (!item.knowledgeCode) {
      notify("请先编辑资料填写主知识点编码", "error");
      return;
    }
    if (!item.description?.trim()) {
      notify("请先编辑资料填写简介，再同步图谱", "error");
      return;
    }
    setBusy(true);
    try {
      await teachingResourcesApi.syncGraph(item.id);
      notify("已同步 EXPLAINS 到知识图谱（含简介 description）");
      await load();
    } catch (cause) {
      notify(cause.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!String(form.description || "").trim()) {
      notify("资料简介不能为空：简介会写入图谱 description，并作为 AI 建议依据", "error");
      return;
    }
    if (!String(form.knowledgeCode || "").trim()) {
      notify("请选择主知识点：入库后写入图谱 EXPLAINS，供 GraphRAG 检索", "error");
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload(form);
      if (modal.type === "upload") {
        if (!file) throw new Error("请选择文件");
        await teachingResourcesApi.upload(payload, file);
        notify("资料已上传为草稿，请提交审核");
      } else {
        await teachingResourcesApi.update(modal.item.id, payload);
        notify("资料信息已更新");
      }
      setModal(null); await load();
    } catch (cause) { notify(cause.message, "error"); }
    finally { setBusy(false); }
  }

  async function download(item) {
    try { const { url } = await teachingResourcesApi.download(item.id); window.open(url, "_blank", "noopener,noreferrer"); }
    catch (cause) { notify(cause.message, "error"); }
  }

  const chipBindings = useMemo(() => {
    const chips = [];
    for (const courseId of courseIds) {
      const chapterIds = chaptersForCourse(form.bindings, courseId);
      if (chapterIds.length) {
        for (const chapterId of chapterIds) chips.push({ courseId, chapterId });
      } else {
        chips.push({ courseId, chapterId: null });
      }
    }
    return chips;
  }, [form.bindings, courseIds]);

  return <section className="page-section">
    <header className="page-heading"><div><p className="eyebrow">TEACHING MATERIALS</p><h1>教学资料</h1><p>上传并关联课程章节（学生可见）；填写简介与主知识点后，管理员入库即可同时写入向量库与图谱 EXPLAINS（GraphRAG）。已入库资料可点「同步图谱」刷新边。</p></div><button className="button primary" type="button" onClick={openUpload}><Plus size={17} />上传资料</button></header>
    <div className="data-panel"><div className="table-toolbar material-toolbar"><form className="search-control" onSubmit={search}><Search size={17} /><input value={searchTerm} placeholder="搜索标题" onChange={(event) => setSearchTerm(event.target.value)} /></form><select aria-label="状态筛选" value={status} onChange={(event) => changeStatus(event.target.value)}><option value="">全部状态</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button className="icon-button" type="button" title="刷新" onClick={() => load()}><RefreshCw size={18} /></button></div>
      <div className="table-wrap"><table className="responsive-table"><thead><tr><th>资料</th><th>学段 / 学科</th><th>审核状态</th><th>知识库</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="empty-cell">正在加载...</td></tr> : error ? <tr><td colSpan="6" className="empty-cell table-error">{error}</td></tr> : items.length ? items.map((item) => <tr key={item.id}>
        <td data-label="资料"><strong className="table-primary-text">{item.title}</strong><small className="table-description">{item.originalFilename}</small></td><td data-label="学段 / 学科">{item.stageCode} / {item.subject}</td><td data-label="审核状态"><span className={`status ${["DRAFT", "PENDING_REVIEW"].includes(item.status) ? "pending" : item.status === "PUBLISHED" ? "enabled" : "disabled"}`}>{statuses[item.status] || item.status}</span></td><td data-label="知识库">{indexStatuses[item.ragIndexStatus] || item.ragIndexStatus}</td><td data-label="更新时间">{date(item.updatedTime)}</td>
        <td data-label="操作"><div className="row-actions">
          <button className="icon-button" title="查看详情" type="button" onClick={() => openDetail(item)}><Eye size={16} /></button>
          <button className="icon-button" title="下载文件" type="button" onClick={() => download(item)}><Download size={16} /></button>
          {["DRAFT", "REJECTED"].includes(item.status) && <>
            <button className="icon-button" title="编辑信息" type="button" onClick={() => openEdit(item)}><Edit3 size={16} /></button>
            <button className="icon-button" title="提交审核" type="button" disabled={busy} onClick={() => perform("submit", item, "已提交审核")}><Send size={16} /></button>
          </>}
          {isAdmin && item.status === "PENDING_REVIEW" && <>
            <button className="icon-button" title="审核通过" type="button" onClick={() => { setNote(""); setModal({ type: "approve", item }); }}><Check size={16} /></button>
            <button className="icon-button danger" title="驳回" type="button" onClick={() => { setNote(""); setModal({ type: "reject", item }); }}><X size={16} /></button>
          </>}
          {isAdmin && item.status === "APPROVED" && <button className="icon-button" title="发布" type="button" onClick={() => setModal({ type: "publish", item })}><Upload size={16} /></button>}
          {isAdmin && item.status === "PUBLISHED" && ["NOT_INDEXED", "FAILED", "UNKNOWN"].includes(item.ragIndexStatus) && <button className="icon-button" title={!item.knowledgeCode ? "请先编辑并填写主知识点" : !item.description?.trim() ? "请先编辑并填写简介" : !indexable(item) ? "仅支持 20 MB 内的 PDF、DOCX、PPTX 文本入库" : !retryReady(item) ? "结果待确认，15 分钟后可重试" : item.ragIndexStatus === "NOT_INDEXED" ? "知识库入库（向量+图谱）" : "重试入库"} type="button" disabled={busy || !indexable(item) || !retryReady(item) || !item.knowledgeCode || !item.description?.trim()} onClick={() => setModal({ type: "index", item })}><Database size={16} /></button>}
          {item.status === "PUBLISHED" && item.ragIndexStatus === "INDEXED" && <button className="icon-button" title="同步图谱 EXPLAINS（按当前知识点与简介）" type="button" disabled={busy || !item.knowledgeCode || !item.description?.trim()} onClick={() => syncGraph(item)}><GitBranch size={16} /></button>}
          {isAdmin && item.status === "PUBLISHED" && <button className="icon-button" title={["INDEXING", "DEINDEXING"].includes(item.ragIndexStatus) || !retryReady(item) ? "知识库正在处理，暂不能撤回" : "撤回发布"} type="button" disabled={busy || ["INDEXING", "DEINDEXING"].includes(item.ragIndexStatus) || !retryReady(item)} onClick={() => setModal({ type: "withdraw", item })}><Undo2 size={16} /></button>}
          {item.status === "WITHDRAWN" && <button className="icon-button" title="重新编辑" type="button" disabled={busy} onClick={() => perform("reopen", item, "资料已恢复为草稿")}><Edit3 size={16} /></button>}
        </div></td></tr>) : <tr><td colSpan="6" className="empty-cell">暂无资料</td></tr>}</tbody></table></div>
      <div className="material-pagination"><button className="button ghost" type="button" disabled={page <= 1 || loading} onClick={() => turnPage(page - 1)}>上一页</button><span>第 {page} 页</span><button className="button ghost" type="button" disabled={!hasMore || loading} onClick={() => turnPage(page + 1)}>下一页</button></div>
    </div>

    {["upload", "edit"].includes(modal?.type) && <Modal title={modal.type === "upload" ? "上传教学资料" : "编辑资料信息"} description="课程/章节绑定用于学生端挂载；主知识点用于图谱 EXPLAINS 与 GraphRAG 检索。简介必填，对标章节导语。" onClose={() => setModal(null)} width={720}>
      <form className="material-form resource-form" onSubmit={save}>
        <section className="form-section">
          <h3>基础信息</h3>
          <label>标题<input required maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <div className="field-pair">
            <label>学段
              <select
                required
                disabled={stageLocked}
                value={form.stageCode}
                onChange={(e) => setForm({ ...form, stageCode: e.target.value })}
                title={stageLocked ? "已随关联课程年级锁定" : undefined}
              >
                <option value="">请选择</option>
                {Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>学科<input required maxLength={64} readOnly={subjectLocked} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={subjectLocked ? "已随课程锁定" : "如：信息科技"} /></label>
          </div>
          <div className="field-pair">
            <label>年级<input maxLength={32} readOnly={gradeLocked} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder={gradeLocked ? "已随课程锁定" : "可选"} /></label>
            <label>教材<input maxLength={255} value={form.textbook} onChange={(e) => setForm({ ...form, textbook: e.target.value })} placeholder="可选" /></label>
          </div>
          <label>资料简介（必填，图谱 description / AI 建议依据）
            <textarea required maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="用几句话说明本资料讲解什么知识点、适用场景" />
          </label>
        </section>

        <section className="form-section knowledge-cover-panel">
          <header className="knowledge-cover-header">
            <div>
              <strong>主知识点（图谱 EXPLAINS）</strong>
              <small>与课程章节绑定不同：这里决定入库后挂到哪个 KnowledgePoint，并参与 GraphRAG。</small>
            </div>
            <AiSuggestButton suggesting={suggesting} onClick={suggestKnowledge} />
          </header>
          {suggestNote && <p className="binding-hint">{suggestNote}</p>}
          <KnowledgePointPicker
            mode="single"
            points={knowledgePoints}
            selectedCodes={form.knowledgeCode ? [form.knowledgeCode] : []}
            aiSuggestedCodes={aiSuggestedCodes}
            onChange={(codes) => setForm({ ...form, knowledgeCode: codes[0] || "" })}
            emptyText="暂无知识点目录，请重启 Learning 并同步扩展知识目录"
          />
        </section>

        <section className="form-section">
          <h3>关联课程与章节</h3>
          <p className="binding-hint">用于学生端在课程/章节下看到本资料；不自动决定图谱知识点。</p>
          <div className="binding-panel">
            <label className="binding-search">搜索课程<input value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} placeholder="输入课程名称筛选已发布课程" /></label>
            {chipBindings.length > 0 && (
              <div className="binding-chips">
                {chipBindings.map((binding) => (
                  <button
                    key={`${binding.courseId}-${binding.chapterId ?? "course"}`}
                    className="binding-chip"
                    type="button"
                    onClick={() => (binding.chapterId == null ? removeCourseChip(binding.courseId) : removeBindingChip(binding))}
                    title="移除"
                  >
                    <span>{bindingLabel(binding, courses, chaptersByCourse)}</span>
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}
            <div className="binding-course-list">
              {(() => {
                const visible = form.subject.trim()
                  ? courses.filter((course) => !course.subject || course.subject.trim().toLowerCase() === form.subject.trim().toLowerCase() || courseIds.includes(course.id))
                  : courses;
                if (!visible.length) return <p className="binding-empty">{form.subject.trim() ? `暂无学科为「${form.subject}」的已发布课程` : "暂无已发布课程，请先发布课程后再关联"}</p>;
                return visible.map((course) => {
                const selected = courseIds.includes(course.id);
                const chapterIds = chaptersForCourse(form.bindings, course.id);
                const chapters = chaptersByCourse[course.id] || [];
                return (
                  <div className={`binding-course${selected ? " selected" : ""}`} key={course.id}>
                    <label className="binding-course-check">
                      <input type="checkbox" checked={selected} onChange={() => toggleCourse(course)} />
                      <span>
                        <strong>{course.title}</strong>
                        <small>#{course.id} · {course.subject || "-"}{course.gradeLevel ? ` · ${course.gradeLevel}` : ""}</small>
                      </span>
                    </label>
                    {selected && (
                      <div className="binding-chapters">
                        <p>关联章节（可多选；不选则仅关联课程）</p>
                        {chapters.length === 0 ? <small className="binding-empty">该课程暂无章节，将仅关联整课</small> : chapters.map((chapter) => (
                          <label key={chapter.id}>
                            <input
                              type="checkbox"
                              checked={chapterIds.includes(chapter.id)}
                              onChange={() => toggleChapter(course.id, chapter.id)}
                            />
                            <span>{chapter.sortOrder != null ? `${chapter.sortOrder}. ` : ""}{chapter.title}</span>
                          </label>
                        ))}
                        {hasCourseOnly(form.bindings, course.id) && chapterIds.length === 0 && chapters.length > 0 && (
                          <small className="binding-hint">当前仅关联课程，未选择具体章节</small>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
              })()}
            </div>
            {contextError && <p className="form-error">课程或章节加载失败：{contextError}</p>}
          </div>
        </section>

        <section className="form-section">
          <h3>来源与文件</h3>
          <label>素材来源 / 版权说明<input required maxLength={255} value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} placeholder="教材页码、原创说明或版权来源" /></label>
          {modal.type === "upload" && (
            <label className="file-drop">
              <Upload size={18} />
              <span>{file ? file.name : "点击选择资料文件（PDF / DOCX / PPTX / 图片 / MP4）"}</span>
              <input type="file" accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.mp4" required onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          )}
        </section>

        <div><button className="button ghost" type="button" onClick={() => setModal(null)}>取消</button><button className="button primary" disabled={busy} type="submit">{busy ? "保存中..." : "保存"}</button></div>
      </form>
    </Modal>}

    {modal?.type === "detail" && <Modal title="资料详情" description={modal.item.title} onClose={() => setModal(null)} width={720}>
      <div className="material-detail">
        <section className="material-detail-hero">
          <div className="material-detail-hero-top">
            <div className="material-detail-file">
              <span className="material-detail-file-icon"><FileText size={20} /></span>
              <div>
                <strong title={modal.item.originalFilename}>{modal.item.originalFilename}</strong>
                <small>
                  {(modal.item.sizeBytes / 1024 / 1024).toFixed(2)} MB
                  {modal.item.mimeType ? ` · ${modal.item.mimeType}` : ""}
                </small>
              </div>
            </div>
            <div className="material-detail-badges">
              <span className={`material-chip ${["DRAFT", "PENDING_REVIEW"].includes(modal.item.status) ? "tone-pending" : modal.item.status === "PUBLISHED" ? "tone-ok" : "tone-muted"}`}>
                {statuses[modal.item.status] || modal.item.status}
              </span>
              <span className="material-chip tone-muted">{indexStatuses[modal.item.ragIndexStatus] || modal.item.ragIndexStatus}</span>
            </div>
          </div>
          <p className="material-detail-desc">{modal.item.description?.trim() || "暂无简介"}</p>
        </section>

        <section className="material-detail-section">
          <h3>基本信息</h3>
          <div className="material-detail-grid">
            <div className="material-detail-field"><span>学段</span><strong>{STAGE_LABELS[modal.item.stageCode] || modal.item.stageCode || "-"}</strong></div>
            <div className="material-detail-field"><span>学科</span><strong>{modal.item.subject || "-"}</strong></div>
            <div className="material-detail-field"><span>年级</span><strong>{modal.item.grade || "-"}</strong></div>
            <div className="material-detail-field"><span>教材</span><strong>{modal.item.textbook || "-"}</strong></div>
            <div className="material-detail-field"><span>知识点编码</span><strong>{modal.item.knowledgeCode || "-"}</strong></div>
            <div className="material-detail-field"><span>来源说明</span><strong>{modal.item.sourceNote || "-"}</strong></div>
            <div className="material-detail-field"><span>发布时间</span><strong>{date(modal.item.publishedTime)}</strong></div>
            <div className="material-detail-field"><span>更新时间</span><strong>{date(modal.item.updatedTime)}</strong></div>
            <div className="material-detail-field"><span>审核意见</span><strong>{modal.item.reviewNote || "-"}</strong></div>
          </div>
        </section>

        <section className="material-detail-section">
          <h3>关联课程 / 章节</h3>
          {modal.item.bindings?.length ? (
            <ul className="material-detail-bindings">
              {modal.item.bindings.map((binding, index) => (
                <li key={`${binding.courseId}-${binding.chapterId ?? "c"}-${index}`}>
                  <strong>{binding.courseTitle || `课程 #${binding.courseId}`}</strong>
                  <small>{binding.chapterId != null ? (binding.chapterTitle || `章节 #${binding.chapterId}`) : "整课适用"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="material-detail-desc">
              {modal.item.courseId ? `课程 #${modal.item.courseId}` : "未关联课程"}
              {modal.item.chapterTitle ? ` / ${modal.item.chapterTitle}` : ""}
            </p>
          )}
        </section>

        <section className="material-detail-section">
          <h3>操作记录</h3>
          {events.length ? (
            <ol className="material-events">
              {events.map((event) => (
                <li key={event.id}>
                  <time>{date(event.createdTime)}</time>
                  <strong>{event.action}</strong>
                  <span>{event.fromStatus || "-"} → {event.toStatus || "-"}</span>
                  {event.note && <p>{event.note}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="material-detail-desc">暂无操作记录</p>
          )}
        </section>
      </div>
    </Modal>}

    {["approve", "reject", "publish", "index", "withdraw"].includes(modal?.type) && <Modal title={({ approve: "审核通过", reject: "驳回资料", publish: "发布资料", index: "知识库入库", withdraw: "撤回发布" })[modal.type]} description={modal.type === "publish" ? "发布后可作为教学资料使用，但不会自动进入知识库。" : modal.type === "index" ? "将提取文档文本写入向量库，并把简介+知识点同步到图谱 EXPLAINS（GraphRAG）。" : `资料：${modal.item.title}`} onClose={() => setModal(null)} width={480}><div className="material-confirm">{["approve", "reject"].includes(modal.type) && <label>审核意见{modal.type === "reject" ? "（必填）" : "（可选）"}<textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>}<div className="confirm-actions"><button className="button ghost" type="button" onClick={() => setModal(null)}>取消</button><button className="button primary" type="button" disabled={busy || (modal.type === "reject" && !note.trim())} onClick={() => perform(modal.type, modal.item, modal.type === "index" ? "已开始入库" : "操作成功", note)}>{busy ? "处理中..." : "确认"}</button></div></div></Modal>}
  </section>;
}
