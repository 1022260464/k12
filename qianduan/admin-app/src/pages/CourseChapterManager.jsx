import { Edit3, FileText, ListTree, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, knowledgeGraphApi, teachingResourcesApi } from "../api/client.js";
import { AiSuggestButton, KnowledgePointPicker, KnowledgeSuggestionPreview } from "../components/KnowledgePointPicker.jsx";
import { RichTextField } from "../components/RichTextField.jsx";
import { Modal } from "../components/Modal.jsx";
import { CourseSectionManager } from "./CourseSectionManager.jsx";

const emptyChapter = { title: "", content: "", sortOrder: 1 };

const STAGE_LABELS = {
  LOW_PRIMARY: "小学低年级",
  HIGH_PRIMARY: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** 本地即时匹配，不依赖后端/大模型，保证「AI 建议」可点可用。 */
function localSuggestKnowledge(title, content, points, limit = 8) {
  const hay = `${title || ""} ${stripHtml(content)}`.toLowerCase();
  if (!hay.trim() || !points?.length) return [];
  const scored = [];
  for (const point of points) {
    let score = 0;
    const reasons = [];
    const pointTitle = String(point.title || "").toLowerCase();
    const code = String(point.code || "").toLowerCase();
    if (pointTitle && hay.includes(pointTitle)) {
      score += 10;
      reasons.push("title");
    }
    for (const token of pointTitle.split(/[\s/、，,；;：:()（）\[\]|-]+/).filter((t) => t.length >= 2)) {
      if (hay.includes(token)) {
        score += 3;
        reasons.push("title-token");
        break;
      }
    }
    for (const alias of point.aliases || []) {
      const normalized = String(alias || "").trim().toLowerCase();
      if (normalized.length >= 2 && hay.includes(normalized)) {
        score += 8;
        reasons.push("alias");
        break;
      }
    }
    let keywordHits = 0;
    for (const keyword of point.keywords || []) {
      const normalized = String(keyword || "").trim().toLowerCase();
      if (normalized.length >= 2 && hay.includes(normalized)) {
        score += 2;
        keywordHits += 1;
        if (keywordHits >= 3) break;
      }
    }
    if (keywordHits) reasons.push("keyword");
    for (const segment of code.split(/[._-]+/).filter((item) => item.length >= 4)) {
      if (hay.includes(segment)) {
        score += 2;
        reasons.push("code");
        break;
      }
    }
    // 必须命中该知识点自身的标题、别名、关键词或编码，不能只凭“大类”批量推荐。
    if (score > 0 && reasons.length) scored.push({ code: point.code, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, limit).map((item) => item.code);
}

/** 由课程年级推导资料学段，课程附件不可手改。 */
function stageCodeFromCourse(course) {
  const text = String(course?.gradeLevel || "").trim().toLowerCase();
  if (!text) return "JUNIOR_HIGH";
  if (/高中|高一|高二|高三|senor|senior/.test(text)) return "SENIOR_HIGH";
  if (/初中|初一|初二|初三|七年级|八年级|九年级|junior|middle/.test(text)) return "JUNIOR_HIGH";
  if (/小学高|高年级|四|五|六|4|5|6|high.?primary|upper.?primary/.test(text)) return "HIGH_PRIMARY";
  if (/小学低|低年级|一|二|三|1|2|3|low.?primary|lower.?primary|小学/.test(text)) return "LOW_PRIMARY";
  return "JUNIOR_HIGH";
}

export function CourseChapterManager({ course, notify, onClose, isAdmin = false }) {
  const [tab, setTab] = useState("chapters");
  const [chapters, setChapters] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyChapter);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionChapter, setSectionChapter] = useState(null);
  const [materials, setMaterials] = useState([]);
  const courseStageCode = useMemo(() => stageCodeFromCourse(course), [course?.gradeLevel]);
  const [materialForm, setMaterialForm] = useState({
    title: "",
    subject: course.subject || "",
    sourceNote: "",
    chapterIds: [],
    knowledgeCode: "",
  });
  const [materialFile, setMaterialFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [aiSuggestedCodes, setAiSuggestedCodes] = useState([]);
  const [suggestNote, setSuggestNote] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [savingCovers, setSavingCovers] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewSummary, setReviewSummary] = useState("");
  const canEditKnowledge = Boolean(isAdmin);

  async function load() {
    setLoading(true);
    try { setChapters(await coursesApi.chapters(course.id)); }
    catch (error) { notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  async function loadMaterials() {
    try {
      const page = await teachingResourcesApi.page({ page: 1, size: 50, keyword: course.title });
      setMaterials((page.items || []).filter((item) => item.courseId === course.id
        || (item.bindings || []).some((binding) => binding.courseId === course.id)));
    } catch (error) { notify(error.message, "error"); }
  }

  async function loadKnowledgeCatalog() {
    try {
      const [points, status] = await Promise.all([
        knowledgeGraphApi.points({ limit: 500 }),
        knowledgeGraphApi.status().catch(() => null),
      ]);
      const list = Array.isArray(points) ? points : [];
      setKnowledgePoints(list);
      if (!list.length) {
        setSuggestNote("知识点目录为空：请联系管理员同步知识目录后再试");
      } else if (status && status.enabled === false) {
        setSuggestNote(`已加载 ${list.length} 个知识点。图谱未启用时仍可勾选预览；保存绑定需先启用图谱服务`);
      } else if (status && status.ready === false) {
        setSuggestNote(`已加载 ${list.length} 个知识点。图谱暂未就绪，请稍后再保存绑定`);
      } else {
        setSuggestNote(`已加载 ${list.length} 个知识点（含大类分组）`);
      }
    } catch {
      setKnowledgePoints([]);
      setSuggestNote("知识点目录暂时无法加载，请稍后重试");
    }
  }

  useEffect(() => { load(); loadKnowledgeCatalog(); }, [course.id]);
  useEffect(() => { if (tab === "materials") loadMaterials(); }, [tab, course.id]);

  async function edit(chapter) {
    try {
      const detail = await coursesApi.chapter(course.id, chapter.id);
      setEditing(detail);
      setForm({ title: detail.title, content: detail.content, sortOrder: detail.sortOrder });
      setSuggestNote("");
      setReviewItems([]);
      setReviewSummary("");
      try {
        const covers = await coursesApi.chapterCovers(course.id, chapter.id);
        setSelectedCodes((covers.covers || []).map((item) => item.code));
        setAiSuggestedCodes([]);
      } catch {
        setSelectedCodes([]);
        setAiSuggestedCodes([]);
      }
    } catch (error) { notify(error.message, "error"); }
  }

  function create() {
    setEditing(null);
    setForm({ ...emptyChapter, sortOrder: chapters.length + 1 });
    setSelectedCodes([]);
    setAiSuggestedCodes([]);
    setSuggestNote("");
    setReviewItems([]);
    setReviewSummary("");
  }

  async function save(event) {
    event.preventDefault();
    if (!String(form.title || "").trim()) {
      notify("请填写章节标题", "error");
      return;
    }
    if (!stripHtml(form.content)) {
      notify("章节导语不能为空：导语会写入图谱描述，并作为 AI 建议依据", "error");
      return;
    }
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
    try {
      await coursesApi.removeChapter(course.id, chapter.id);
      notify("章节已删除");
      if (editing?.id === chapter.id) create();
      await load();
    } catch (error) { notify(error.message, "error"); }
  }

  async function suggestCovers() {
    if (!canEditKnowledge) {
      notify("仅管理员可修改知识点绑定", "error");
      return;
    }
    const catalog = knowledgePoints;
    if (!catalog.length) {
      notify("暂无知识点目录可建议", "error");
      return;
    }
    const intro = stripHtml(form.content);
    if (!intro) {
      notify("请先填写章节导语：导语会写入图谱描述，也是 AI 建议的依据", "error");
      return;
    }
    setSuggesting(true);
    try {
      let codes = [];
      let sourceLabel = "本地匹配";
      try {
        const result = await Promise.race([
          knowledgeGraphApi.suggestCovers({
            title: form.title,
            content: form.content,
            limit: 8,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("suggest-timeout")), 10000)),
        ]);
        codes = (result?.suggestions || []).map((item) => item.code).filter(Boolean);
        if (codes.length) {
          sourceLabel = result.source === "llm" ? "大模型" : "目录匹配";
        }
      } catch {
        // 后端/超时：走本地
      }
      if (!codes.length) {
        codes = localSuggestKnowledge(form.title, form.content, catalog, 8);
        sourceLabel = "本地匹配";
      }
      if (!codes.length) {
        notify("暂无匹配建议，请在下方手工勾选", "error");
        setSuggestNote("");
        return;
      }
      const catalogCodes = new Set(catalog.map((point) => point.code));
      const previewCodes = [...new Set(codes)].filter((code) => catalogCodes.has(code));
      if (!previewCodes.length) {
        notify("建议结果不在当前知识点目录中，请刷新目录后重试", "error");
        setAiSuggestedCodes([]);
        setSuggestNote("");
        return;
      }
      setAiSuggestedCodes(previewCodes);
      setSuggestNote(`${sourceLabel}建议 ${previewCodes.length} 个，仅供预览；采纳后才会加入当前选择`);
      notify(`${sourceLabel}建议已生成，请在预览区核对后采纳`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSuggesting(false);
    }
  }

  function acceptAiSuggestion(code) {
    if (!code || selectedCodes.includes(code)) return;
    setSelectedCodes((current) => [code, ...current.filter((item) => item !== code)]);
  }

  function acceptAllAiSuggestions() {
    if (!aiSuggestedCodes.length) return;
    setSelectedCodes((current) => [
      ...aiSuggestedCodes.filter((code) => !current.includes(code)),
      ...current,
    ]);
  }

  function closeAiSuggestions() {
    setAiSuggestedCodes([]);
    setSuggestNote("");
  }

  async function saveCovers() {
    if (!canEditKnowledge) {
      notify("仅管理员可保存知识点绑定", "error");
      return;
    }
    if (!editing) {
      notify("请先保存章节，再绑定知识点", "error");
      return;
    }
    if (!stripHtml(form.content)) {
      notify("请先填写并保存章节导语，再绑定知识点", "error");
      return;
    }
    setSavingCovers(true);
    try {
      // 先落库导语，再写图谱 COVERS（导语即图谱 description）
      await coursesApi.updateChapter(course.id, editing.id, {
        title: form.title,
        content: form.content,
        sortOrder: Number(form.sortOrder),
      });
      await coursesApi.replaceChapterCovers(course.id, editing.id, selectedCodes);
      notify("知识点绑定已保存（导语已同步为图谱章节描述）");
      setAiSuggestedCodes([]);
      setSuggestNote("");
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setSavingCovers(false); }
  }

  async function reviewCovers() {
    if (!canEditKnowledge) return;
    if (!selectedCodes.length) {
      notify("请先勾选或绑定知识点再审查", "error");
      return;
    }
    if (!stripHtml(form.content) && !String(form.title || "").trim()) {
      notify("请先填写章节标题或导语作为审查依据", "error");
      return;
    }
    setReviewing(true);
    try {
      const result = await knowledgeGraphApi.reviewAlignment({
        title: form.title,
        content: form.content,
        knowledgeCodes: selectedCodes,
      });
      setReviewItems(result.items || []);
      setReviewSummary(result.summary || "");
      notify(result.summary || "审查完成");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setReviewing(false);
    }
  }

  async function uploadMaterial(event) {
    event.preventDefault();
    if (!materialFile) return;
    if (course.status !== 1) {
      notify("请先发布课程，再上传并关联教学资料", "error");
      return;
    }
    setUploading(true);
    try {
      const chapterIds = materialForm.chapterIds || [];
      const bindings = chapterIds.length
        ? chapterIds.map((chapterId) => ({ courseId: course.id, chapterId }))
        : [{ courseId: course.id, chapterId: null }];
      await teachingResourcesApi.upload({
        title: materialForm.title,
        description: "",
        stageCode: courseStageCode,
        subject: course.subject || materialForm.subject,
        sourceNote: materialForm.sourceNote,
        courseId: course.id,
        chapterId: chapterIds[0] || null,
        bindings,
        grade: course.gradeLevel || "",
        textbook: "",
        knowledgeCode: canEditKnowledge ? (materialForm.knowledgeCode || "") : "",
      }, materialFile);
      notify("资料已上传为草稿，请到教学资料提交审核");
      setMaterialFile(null);
      setMaterialForm({ title: "", subject: course.subject || "", sourceNote: "", chapterIds: [], knowledgeCode: "" });
      event.currentTarget.reset();
      await loadMaterials();
    } catch (error) { notify(error.message, "error"); }
    finally { setUploading(false); }
  }

  function toggleMaterialChapter(chapterId) {
    setMaterialForm((current) => {
      const selected = current.chapterIds.includes(chapterId);
      return {
        ...current,
        chapterIds: selected
          ? current.chapterIds.filter((id) => id !== chapterId)
          : [...current.chapterIds, chapterId],
      };
    });
  }

  return <Modal title={`课程工作台 · ${course.title}`} description="维护章节小节与知识点绑定，并可直接为课程上传教学附件（走审核发布后学生可见）。" onClose={onClose} variant="workspace">
    <div className="course-workspace">
      <div className="workspace-tabs">
        <button className={tab === "chapters" ? "active" : ""} type="button" onClick={() => setTab("chapters")}>章节与小节</button>
        <button className={tab === "materials" ? "active" : ""} type="button" onClick={() => setTab("materials")}>课程附件</button>
      </div>
      {tab === "materials" ? (
        <div className="course-workspace-main">
          <section className="workspace-pane">
            <form className="material-form resource-form workspace-import" onSubmit={uploadMaterial}>
              <section className="form-section">
                <h3>上传课程附件</h3>
                <p className="binding-hint">文件进入教学资料草稿，需管理员审核发布后学生端可见。课程须已发布才能关联。</p>
                <div className="field-pair">
                  <label>标题<input value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} required /></label>
                  <label>学段 / 学科
                    <input
                      readOnly
                      value={`${STAGE_LABELS[courseStageCode] || courseStageCode} · ${course.subject || "-"}${course.gradeLevel ? `（${course.gradeLevel}）` : ""}`}
                      title="随当前课程锁定，不可修改"
                    />
                  </label>
                </div>
                <label>来源说明<input value={materialForm.sourceNote} onChange={(e) => setMaterialForm({ ...materialForm, sourceNote: e.target.value })} required /></label>
                <label>主知识点（可选）
                  <input
                    list="chapter-material-knowledge-codes"
                    value={materialForm.knowledgeCode}
                    maxLength={128}
                    readOnly={!canEditKnowledge}
                    onChange={(e) => canEditKnowledge && setMaterialForm({ ...materialForm, knowledgeCode: e.target.value.trim() })}
                    placeholder={canEditKnowledge ? "选择或搜索知识点名称" : "仅管理员可绑定知识点"}
                  />
                </label>
                {!canEditKnowledge && (
                  <p className="binding-hint">教师上传附件时默认不绑定知识点；管理员可在「教学资料」中补绑。</p>
                )}
                <datalist id="chapter-material-knowledge-codes">
                  {knowledgePoints.map((point) => (
                    <option key={point.code} value={point.code}>{point.title}</option>
                  ))}
                </datalist>
                <div className="binding-chapters" style={{ margin: 0 }}>
                  <p>关联章节（可多选；不选则仅关联本课程）</p>
                  {chapters.length === 0 ? <small className="binding-empty">暂无章节，将仅关联整课</small> : chapters.map((chapter) => (
                    <label key={chapter.id}>
                      <input type="checkbox" checked={materialForm.chapterIds.includes(chapter.id)} onChange={() => toggleMaterialChapter(chapter.id)} />
                      <span>{chapter.sortOrder}. {chapter.title}</span>
                    </label>
                  ))}
                </div>
                <div className="import-panel-actions">
                  <label className="file-drop compact-drop">
                    <Upload size={16} />
                    <span>{materialFile ? materialFile.name : "选择附件文件"}</span>
                    <input type="file" accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.mp4" required onChange={(e) => setMaterialFile(e.target.files?.[0] || null)} />
                  </label>
                  <button className="button primary compact" type="submit" disabled={!materialFile || uploading}><Upload size={15} />{uploading ? "上传中..." : "上传附件"}</button>
                </div>
              </section>
            </form>
            <div className="attachment-list material-list">
              {materials.length ? materials.map((item) => (
                <div key={item.id}><strong>{item.title}</strong><small>{item.status} · {item.originalFilename}{item.chapterTitle ? ` · ${item.chapterTitle}` : ""}{item.knowledgeCode ? ` · ${item.knowledgeCode}` : ""}</small></div>
              )) : <p className="inline-empty">暂无已关联本课程的教学资料</p>}
            </div>
          </section>
        </div>
      ) : sectionChapter ? (
        <div className="course-workspace-main is-sections">
          <CourseSectionManager course={course} chapter={sectionChapter} notify={notify} onBack={() => setSectionChapter(null)} />
        </div>
      ) : (
        <div className="course-workspace-main">
          <div className="manager-layout chapter-manager">
            <section className="manager-list">
              <header><strong>课程章节</strong><button className="icon-button" type="button" title="刷新章节" onClick={load}><RefreshCw size={17} /></button></header>
              {loading ? <p className="manager-empty">正在加载章节...</p> : chapters.length === 0 ? <p className="manager-empty">暂无章节。也可关闭后用 JSON 批量导入整课结构。</p> : chapters.map((chapter) => <article className={editing?.id === chapter.id ? "selected" : ""} key={chapter.id}><span><FileText size={17} /></span><div><strong>{chapter.sortOrder}. {chapter.title}</strong><small>{formatTime(chapter.updatedTime)}</small></div><button className="icon-button" type="button" title="管理小节" onClick={() => setSectionChapter(chapter)}><ListTree size={15} /></button><button className="icon-button" type="button" title="编辑章节" onClick={() => edit(chapter)}><Edit3 size={15} /></button><button className="icon-button danger" type="button" title="删除章节" onClick={() => remove(chapter)}><Trash2 size={15} /></button></article>)}
            </section>
            <form className="manager-form" onSubmit={save}>
              <header><div><strong>{editing ? "编辑章节" : "新建章节"}</strong><small>章节导语必填：写入图谱描述，并作为 AI 建议依据；正文放在小节中。</small></div><button className="button ghost compact" type="button" onClick={create}><Plus size={15} />新建</button></header>
              <label>章节标题<input value={form.title} maxLength={128} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
              <label>排序<input type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required /></label>
              <RichTextField
                label="章节导语（必填）"
                value={form.content}
                resetKey={editing?.id ? `chapter-${editing.id}` : "chapter-new"}
                onChange={(content) => setForm({ ...form, content })}
                required
                hint="必填。用几句话说明本章教什么；保存后会同步给 AI 建议与知识图谱绑定。"
                onUploadImage={(file) => coursesApi.uploadContentImage(course.id, file)}
              />

              <section className="form-section knowledge-cover-panel">
                <header className="knowledge-cover-header">
                  <div>
                    <strong>本章知识点</strong>
                    <small>
                      {canEditKnowledge
                        ? "AI 建议会单独预览，采纳后进入当前选择；保存绑定后可再审查。"
                        : "仅可查看；改绑请联系管理员。"}
                    </small>
                  </div>
                  {canEditKnowledge && (
                    <div className="knowledge-cover-actions">
                      <AiSuggestButton suggesting={suggesting} onClick={suggestCovers} />
                      <button
                        className="button ghost compact"
                        type="button"
                        disabled={reviewing || !selectedCodes.length}
                        onClick={reviewCovers}
                      >
                        <ShieldCheck size={14} />{reviewing ? "审查中…" : "审查"}
                      </button>
                    </div>
                  )}
                </header>
                {suggestNote && <p className="binding-hint">{suggestNote}</p>}
                <KnowledgeSuggestionPreview
                  points={knowledgePoints}
                  suggestedCodes={aiSuggestedCodes}
                  selectedCodes={selectedCodes}
                  mode="multi"
                  onAccept={acceptAiSuggestion}
                  onAcceptAll={acceptAllAiSuggestions}
                  onClose={closeAiSuggestions}
                />
                <KnowledgePointPicker
                  points={knowledgePoints}
                  selectedCodes={selectedCodes}
                  aiSuggestedCodes={aiSuggestedCodes}
                  mode="multi"
                  readOnly={!canEditKnowledge}
                  onChange={setSelectedCodes}
                  emptyText="暂无知识点目录。请联系管理员同步知识目录后再试。"
                />
                {reviewItems.length > 0 && (
                  <div className="kg-review-panel">
                    {reviewSummary ? <p className="kg-review-summary">{reviewSummary}</p> : null}
                    <ul className="kg-review-list">
                      {reviewItems.map((item) => (
                        <li key={item.code} className={`is-${String(item.verdict || "").toLowerCase()}`}>
                          <div className="kg-review-row">
                            <strong>{item.title || item.code}</strong>
                            <span>{item.verdict === "KEEP" ? "匹配" : item.verdict === "REVIEW" ? "待核" : "不符"}</span>
                          </div>
                          {item.reason ? <p>{item.reason}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {canEditKnowledge ? (
                  <button className="button ghost" type="button" disabled={!editing || savingCovers} onClick={saveCovers}>
                    <Save size={15} />{savingCovers ? "绑定保存中..." : editing ? "保存知识点绑定" : "请先保存章节再绑定"}
                  </button>
                ) : null}
              </section>

              <button className="button primary" type="submit" disabled={saving}><Save size={16} />{saving ? "保存中..." : "保存章节"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  </Modal>;
}

function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
