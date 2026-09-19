import { CheckCircle2, Edit3, Plus, RefreshCw, Save, Search, Trash2, Upload, UserCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { homeworksApi, usersApi } from "../api/client.js";
import { ExpandableTextarea } from "../components/MarkdownField.jsx";
import { Modal } from "../components/Modal.jsx";

const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const defaultChoiceOptions = () => OPTION_KEYS.slice(0, 4).map((key) => ({ key, content: "" }));
const emptyQuestion = {
  type: "SHORT_ANSWER",
  stem: "",
  score: 10,
  sortOrder: 1,
  options: defaultChoiceOptions(),
  correctAnswers: [],
  referenceAnswer: "",
  analysis: "",
};

export function HomeworkDetailManager({ homework, notify, onClose, initialTab = "questions" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { setTab(initialTab); }, [homework.id, initialTab]);
  const statusMeta = homeworkStatus(homework.status);
  const displayTitle = String(homework.title || "").replace(/（草稿）|\(草稿\)/g, "").trim() || homework.title;
  return <Modal
    title={<span className="workspace-title">作业工作台 · {displayTitle}<span className={`status ${statusMeta.tone}`}>{statusMeta.label}</span></span>}
    description="优先批量导入题目，再为题目上传附件并配置接收人，最后发布。"
    onClose={onClose}
    width={1080}
  >
    <div className="workspace-tabs" role="tablist">
      {[["questions", "题目导入"], ["attachments", "题目附件"], ["recipients", "接收人"], ["submissions", "提交与批改"]].map(([value, label]) => (
        <button className={tab === value ? "active" : ""} type="button" role="tab" aria-selected={tab === value} key={value} onClick={() => setTab(value)}>{label}</button>
      ))}
    </div>
    {tab === "questions" && <QuestionEditor homework={homework} notify={notify} />}
    {tab === "attachments" && <QuestionAttachmentEditor homework={homework} notify={notify} />}
    {tab === "recipients" && <RecipientEditor homework={homework} notify={notify} />}
    {tab === "submissions" && <SubmissionEditor homework={homework} notify={notify} />}
  </Modal>;
}

function RecipientEditor({ homework, notify }) {
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [allUsers, recipientIds] = await Promise.all([
        usersApi.students(),
        homeworksApi.recipients(homework.id),
      ]);
      setStudents(allUsers || []);
      setSelectedIds((recipientIds || []).map(Number));
      setValidation(null);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [homework.id]);

  const filteredStudents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter((student) => [student.username, student.nickname, student.id]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [students, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const missingIds = selectedIds.filter((id) => !students.some((student) => student.id === id));
  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((student) => selectedSet.has(student.id));

  function toggleStudent(studentId) {
    setSelectedIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId]);
    setValidation(null);
  }

  function selectStudents(ids) {
    setSelectedIds((current) => [...new Set([...current, ...ids])]);
    setValidation(null);
  }

  function unselectStudents(ids) {
    const removed = new Set(ids);
    setSelectedIds((current) => current.filter((id) => !removed.has(id)));
    setValidation(null);
  }

  async function validate() {
    try {
      const result = await usersApi.validateStudents(selectedIds);
      setValidation(result);
      notify("学生账号校验完成");
    } catch (error) { notify(error.message, "error"); }
  }

  async function save() {
    setSaving(true);
    try {
      const result = await usersApi.validateStudents(selectedIds);
      setValidation(result);
      if (result.invalidUserIds?.length) {
        notify("存在无效或已停用的学生账号，请先移除", "error");
        return;
      }
      await homeworksApi.setRecipients(homework.id, selectedIds);
      notify("作业接收人已更新");
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return <section className="workspace-pane recipient-editor">
    <div className="workspace-intro"><UserCheck size={22} /><div><strong>选择作业接收人</strong><p>支持按群体批量选择，也可以搜索后逐个勾选。这里只展示 IAM 中角色为学生且状态正常的账号。</p></div></div>
    <div className="recipient-summary"><span><UsersRound size={18} /><strong>{selectedIds.length}</strong> 人已选择</span><div><button className="button ghost compact" type="button" disabled={loading || students.length === 0} onClick={() => selectStudents(students.map((student) => student.id))}>选择全部启用学生</button><button className="button ghost compact" type="button" disabled={selectedIds.length === 0} onClick={() => { setSelectedIds([]); setValidation(null); }}>清空选择</button></div></div>
    <div className="student-picker-toolbar"><label className="search-control"><Search size={17} /><input value={query} placeholder="搜索姓名、用户名或 ID" onChange={(event) => setQuery(event.target.value)} /></label><label className="select-filtered"><input type="checkbox" checked={allFilteredSelected} disabled={loading || filteredStudents.length === 0} onChange={(event) => event.target.checked ? selectStudents(filteredStudents.map((student) => student.id)) : unselectStudents(filteredStudents.map((student) => student.id))} /><span>全选当前结果（{filteredStudents.length}）</span></label></div>
    <div className="student-check-list" aria-busy={loading}>
      {loading ? <p className="manager-empty">正在加载学生列表...</p> : filteredStudents.length === 0 ? <p className="manager-empty">没有符合条件的启用学生</p> : filteredStudents.map((student) => <label className={selectedSet.has(student.id) ? "student-check-row selected" : "student-check-row"} key={student.id}><input type="checkbox" checked={selectedSet.has(student.id)} onChange={() => toggleStudent(student.id)} /><span className="table-avatar">{(student.nickname || student.username).slice(0, 1)}</span><span className="student-identity"><strong>{student.nickname || student.username}</strong><small>{student.username}</small></span><code>#{student.id}</code></label>)}
    </div>
    {missingIds.length > 0 && <div className="recipient-warning"><span>已保存的接收人中有 {missingIds.length} 个账号当前不是启用学生：{missingIds.join(", ")}。</span><button className="button ghost compact" type="button" onClick={() => unselectStudents(missingIds)}>移除失效账号</button></div>}
    {validation && <div className="validation-result"><span>有效账号：{validation.validStudentIds?.length || 0}</span><span className={validation.invalidUserIds?.length ? "invalid" : ""}>无效账号：{validation.invalidUserIds?.join(", ") || "无"}</span></div>}
    <div className="workspace-actions"><button className="button ghost" type="button" disabled={!selectedIds.length || saving} onClick={validate}><CheckCircle2 size={16} />校验已选学生</button><button className="button primary" type="button" disabled={!selectedIds.length || saving || missingIds.length > 0 || validation?.invalidUserIds?.length} onClick={save}><Save size={16} />{saving ? "正在保存" : "保存接收人"}</button></div>
  </section>;
}

function QuestionEditor({ homework, notify }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => ({ ...emptyQuestion, options: defaultChoiceOptions(), correctAnswers: [] }));
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [attachmentSummary, setAttachmentSummary] = useState({ count: 0, limit: 5 });
  const [questionAttachments, setQuestionAttachments] = useState([]);
  const answers = Array.isArray(form.correctAnswers) ? form.correctAnswers : [];
  const options = Array.isArray(form.options) ? form.options : defaultChoiceOptions();
  const questionTypeCode = String(form.type || "SHORT_ANSWER");

  async function loadSummary(questionList) {
    try {
      const summary = await homeworksApi.attachmentSummary(homework.id);
      setAttachmentSummary({ count: Number(summary?.count || 0), limit: Number(summary?.limit || 5) });
    } catch (error) {
      // 旧版 assessment 服务尚未部署 summary 接口时，按题目附件列表汇总。
      if (error.status === 404) {
        try {
          const questions = questionList || await homeworksApi.questions(homework.id) || [];
          const lists = await Promise.all(questions.map((question) => (
            homeworksApi.questionAttachments(homework.id, question.id).catch(() => [])
          )));
          setAttachmentSummary({
            count: lists.reduce((total, list) => total + (list?.length || 0), 0),
            limit: 5,
          });
          return;
        } catch {
          setAttachmentSummary({ count: 0, limit: 5 });
          return;
        }
      }
      notify(error.message, "error");
    }
  }

  async function loadQuestionAttachments(questionId) {
    if (!questionId) { setQuestionAttachments([]); return; }
    try { setQuestionAttachments(await homeworksApi.questionAttachments(homework.id, questionId) || []); }
    catch (error) { notify(error.message, "error"); }
  }

  async function load() {
    try {
      const questions = await homeworksApi.questions(homework.id) || [];
      setItems(questions);
      await loadSummary(questions);
    } catch (error) { notify(error.message, "error"); }
  }

  useEffect(() => { load(); }, [homework.id]);
  useEffect(() => { loadQuestionAttachments(editing?.id); }, [homework.id, editing?.id]);

  function create() {
    setEditing(null);
    setQuestionAttachments([]);
    setForm({ ...emptyQuestion, options: defaultChoiceOptions(), correctAnswers: [], sortOrder: items.length + 1 });
  }
  function edit(item) {
    if (!item) return;
    setEditing(item);
    const nextOptions = (item.options || []).length
      ? item.options.map((option) => ({ key: option.key, content: option.content || "" }))
      : defaultChoiceOptions();
    setForm({
      type: item.type || "SHORT_ANSWER",
      stem: item.stem || "",
      score: item.score ?? 10,
      sortOrder: item.sortOrder ?? 1,
      options: nextOptions,
      correctAnswers: Array.isArray(item.correctAnswers) ? [...item.correctAnswers] : [],
      referenceAnswer: item.referenceAnswer || "",
      analysis: item.analysis || "",
    });
  }
  function changeType(type) {
    setForm((current) => ({
      ...current,
      type,
      correctAnswers: [],
      options: String(type).includes("CHOICE")
        ? (current.options?.length ? current.options : defaultChoiceOptions())
        : (current.options?.length ? current.options : defaultChoiceOptions()),
    }));
  }
  async function save(event) {
    event.preventDefault();
    const safeAnswers = Array.isArray(form.correctAnswers) ? form.correctAnswers : [];
    const safeOptions = Array.isArray(form.options) ? form.options : [];
    if (String(form.type).includes("CHOICE") && !safeAnswers.length) {
      notify(form.type === "SINGLE_CHOICE" ? "请勾选一个正确答案" : "请至少勾选一个正确答案", "error");
      return;
    }
    if (form.type === "TRUE_FALSE" && !safeAnswers.length) {
      notify("请选择判断题正确答案", "error");
      return;
    }
    if (String(form.type).includes("CHOICE") && safeOptions.some((option) => !String(option.content || "").trim())) {
      notify("请填写所有选项内容，或删除多余选项", "error");
      return;
    }
    const payload = toQuestionPayload({ ...form, correctAnswers: safeAnswers, options: safeOptions });
    try {
      if (editing) {
        const updated = await homeworksApi.updateQuestion(homework.id, editing.id, payload);
        notify("题目已更新");
        await load();
        edit(updated || { ...editing, ...payload, id: editing.id, type: payload.type, options: payload.options, correctAnswers: payload.correctAnswers });
      } else {
        const created = await homeworksApi.createQuestion(homework.id, payload);
        notify("题目已创建，可继续上传本题附件");
        await load();
        if (created?.id) edit(created);
        else create();
      }
    } catch (error) { notify(error.message, "error"); }
  }
  async function remove(item) {
    if (!window.confirm("确认删除该题目吗？")) return;
    try {
      await homeworksApi.removeQuestion(homework.id, item.id);
      notify("题目已删除");
      if (editing?.id === item.id) create();
      await load();
    } catch (error) { notify(error.message, "error"); }
  }
  async function importQuestions(event) {
    event.preventDefault();
    if (!importFile) return;
    const formElement = event.currentTarget;
    setImporting(true);
    try {
      const result = await homeworksApi.importQuestions(homework.id, importFile);
      notify(`已导入 ${result.length} 道题目`);
      setImportFile(null);
      formElement.reset();
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setImporting(false); }
  }

  async function refreshAttachments() {
    await Promise.all([loadSummary(), loadQuestionAttachments(editing?.id)]);
  }
  return <div>
    <form className="import-panel workspace-import" onSubmit={importQuestions}>
      <div><strong>推荐：批量导入题目</strong><p>下载 JSON 模板，按题型填写后一次导入；任一条失败则整批回滚。</p></div>
      <div className="import-panel-actions">
        <a className="button ghost compact" href="/templates/question-import.json" download><Upload size={15} />下载题目模板</a>
        <label className="file-drop compact-drop">
          <Upload size={16} />
          <span>{importFile ? importFile.name : "选择 question-import.json"}</span>
          <input type="file" aria-label="题目 JSON 文件" accept=".json,application/json" onChange={(event) => setImportFile(event.target.files?.[0] || null)} disabled={homework.status !== "DRAFT"} />
        </label>
        <button className="button primary compact" type="submit" disabled={!importFile || importing || homework.status !== "DRAFT"}>{importing ? "导入中..." : "上传并导入"}</button>
      </div>
      {homework.status !== "DRAFT" && <small>已发布作业不可再导入题目。</small>}
    </form>
    <div className="manager-layout question-manager">
      <section className="manager-list">
        <header><strong>题目列表</strong><button className="icon-button" type="button" title="刷新题目" onClick={load}><RefreshCw size={17} /></button></header>
        {items.length ? items.map((item) => (
          <article className={editing?.id === item.id ? "selected" : ""} key={item.id}>
            <div><strong>{item.sortOrder}. {item.stem}</strong><small>{questionType(item.type)} · {item.score} 分</small></div>
            <button className="icon-button" type="button" title="编辑题目" onClick={() => edit(item)}><Edit3 size={15} /></button>
            <button className="icon-button danger" type="button" title="删除题目" onClick={() => remove(item)}><Trash2 size={15} /></button>
          </article>
        )) : <p className="manager-empty">暂无题目，请先上方导入或右侧手工创建。</p>}
      </section>
      <form className="manager-form" onSubmit={save}>
        <header>
          <div><strong>{editing ? "编辑题目" : "手工补录题目"}</strong><small>少量补题可用；批量请走上方导入。</small></div>
          <button className="button ghost compact" type="button" onClick={create}><Plus size={15} />新建</button>
        </header>
        <label>题型
          <select value={questionTypeCode} onChange={(event) => changeType(event.target.value)}>
            {["SHORT_ANSWER", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].map((type) => (
              <option key={type} value={type}>{questionType(type)}</option>
            ))}
          </select>
        </label>
        <ExpandableTextarea
          label="题干"
          className="short"
          value={form.stem}
          maxLength={4000}
          required
          onChange={(stem) => setForm({ ...form, stem })}
        />
        <div className="field-pair">
          <label>分值<input type="number" min="0.01" max="100" step="0.01" value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} required /></label>
          <label>排序<input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required /></label>
        </div>
        {questionTypeCode.includes("CHOICE") && (
          <ChoiceOptionsEditor
            multiple={questionTypeCode === "MULTIPLE_CHOICE"}
            options={options}
            correctAnswers={answers}
            onChange={(next) => setForm((current) => ({
              ...current,
              ...next,
              options: Array.isArray(next.options) ? next.options : (current.options || defaultChoiceOptions()),
              correctAnswers: Array.isArray(next.correctAnswers) ? next.correctAnswers : (current.correctAnswers || []),
            }))}
          />
        )}
        {questionTypeCode === "TRUE_FALSE" && (
          <fieldset className="choice-answer-field">
            <legend>正确答案</legend>
            <div className="choice-answer-list">
              {[["TRUE", "正确"], ["FALSE", "错误"]].map(([value, label]) => (
                <label className={`choice-answer-row${answers[0] === value ? " selected" : ""}`} key={value}>
                  <input
                    type="radio"
                    name="true-false-answer"
                    checked={answers[0] === value}
                    onChange={() => setForm({ ...form, correctAnswers: [value] })}
                    required={!answers.length}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <ExpandableTextarea
          label="参考答案"
          className="short"
          value={form.referenceAnswer}
          required={questionTypeCode === "SHORT_ANSWER"}
          onChange={(referenceAnswer) => setForm({ ...form, referenceAnswer })}
        />
        <ExpandableTextarea
          label="解析"
          className="short"
          value={form.analysis}
          onChange={(analysis) => setForm({ ...form, analysis })}
        />
        <QuestionAttachmentPanel
          compact
          homework={homework}
          questionId={editing?.id}
          attachments={questionAttachments}
          summary={attachmentSummary}
          notify={notify}
          onChanged={refreshAttachments}
          emptyHint="先保存题目后，即可为本题上传附件。"
        />
        <button className="button primary" type="submit" disabled={homework.status !== "DRAFT"}><Save size={16} />保存题目</button>
      </form>
    </div>
  </div>;
}

function QuestionAttachmentPanel({
  homework,
  questionId,
  attachments,
  summary,
  notify,
  onChanged,
  compact = false,
  emptyHint = "请先创建题目。",
}) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const limit = summary?.limit ?? 5;
  const totalCount = summary?.count ?? 0;
  const remaining = Math.max(0, limit - totalCount);
  const canUpload = homework.status === "DRAFT" && questionId && remaining > 0;

  async function upload(event) {
    event?.preventDefault?.();
    if (!file || !questionId) return;
    if (remaining <= 0) {
      notify(`每个作业最多上传 ${limit} 个附件`, "error");
      return;
    }
    setBusy(true);
    try {
      await homeworksApi.uploadQuestionAttachment(homework.id, questionId, file);
      setFile(null);
      notify("附件已上传");
      await onChanged?.();
    } catch (error) { notify(error.message, "error"); }
    finally { setBusy(false); }
  }

  async function download(item) {
    try {
      const { url } = await homeworksApi.questionAttachmentUrl(homework.id, questionId, item.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) { notify(error.message, "error"); }
  }

  async function remove(item) {
    try {
      await homeworksApi.deleteQuestionAttachment(homework.id, questionId, item.id);
      notify("附件已删除");
      await onChanged?.();
    } catch (error) { notify(error.message, "error"); }
  }

  return (
    <section className={`question-attachment-panel${compact ? " compact" : ""}`}>
      <div className="question-attachment-head">
        <strong>题目附件</strong>
        <small>本作业 {totalCount}/{limit}，还可上传 {remaining} 个 · 单个不超过 10 MB</small>
      </div>
      {!questionId ? <p className="inline-empty">{emptyHint}</p> : <>
        <div className="attachment-list material-list">
          {attachments.map((item) => (
            <div className="attachment-row" key={item.id}>
              <button className="text-button" type="button" onClick={() => download(item)}>{item.filename}</button>
              <small>{Math.ceil(item.sizeBytes / 1024)} KB</small>
              {homework.status === "DRAFT" && (
                <button className="icon-button danger" title="删除附件" type="button" onClick={() => remove(item)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {!attachments.length && <p className="inline-empty">本题暂无附件</p>}
        </div>
        {homework.status === "DRAFT" && (
          compact ? (
            <div className="inline-actions attachment-upload">
              <label className="file-drop compact-drop">
                <Upload size={16} />
                <span>{file ? file.name : remaining > 0 ? "选择附件文件" : "已达作业附件上限"}</span>
                <input
                  type="file"
                  aria-label="上传题目附件"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  disabled={!canUpload || busy}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <button className="button primary" type="button" disabled={!file || !canUpload || busy} onClick={upload}>
                <Upload size={16} />{busy ? "上传中..." : "上传附件"}
              </button>
            </div>
          ) : (
            <form className="inline-actions attachment-upload" onSubmit={upload}>
              <label className="file-drop compact-drop">
                <Upload size={16} />
                <span>{file ? file.name : remaining > 0 ? "选择附件文件" : "已达作业附件上限"}</span>
                <input
                  type="file"
                  aria-label="上传题目附件"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  disabled={!canUpload || busy}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  required
                />
              </label>
              <button className="button primary" type="submit" disabled={!file || !canUpload || busy}>
                <Upload size={16} />{busy ? "上传中..." : "上传附件"}
              </button>
            </form>
          )
        )}
        <small className="binding-hint">支持 PDF / PNG / JPG / DOCX。附件挂在当前题目下，整份作业合计最多 {limit} 个。</small>
      </>}
    </section>
  );
}

function QuestionAttachmentEditor({ homework, notify }) {
  const [questions, setQuestions] = useState([]);
  const [questionId, setQuestionId] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [summary, setSummary] = useState({ count: 0, limit: 5 });

  async function loadQuestions() {
    try {
      const items = await homeworksApi.questions(homework.id) || [];
      setQuestions(items);
      setQuestionId((current) => current || items[0]?.id || "");
    } catch (error) { notify(error.message, "error"); }
  }

  async function loadSummary() {
    try {
      const value = await homeworksApi.attachmentSummary(homework.id);
      setSummary({ count: Number(value?.count || 0), limit: Number(value?.limit || 5) });
    } catch (error) {
      if (error.status === 404) {
        try {
          const items = questions.length ? questions : await homeworksApi.questions(homework.id) || [];
          const lists = await Promise.all(items.map((question) => (
            homeworksApi.questionAttachments(homework.id, question.id).catch(() => [])
          )));
          setSummary({ count: lists.reduce((total, list) => total + (list?.length || 0), 0), limit: 5 });
          return;
        } catch {
          setSummary({ count: 0, limit: 5 });
          return;
        }
      }
      notify(error.message, "error");
    }
  }

  async function loadAttachments(id) {
    if (!id) { setAttachments([]); return; }
    try { setAttachments(await homeworksApi.questionAttachments(homework.id, id) || []); }
    catch (error) { notify(error.message, "error"); }
  }

  useEffect(() => { loadQuestions(); loadSummary(); }, [homework.id]);
  useEffect(() => { loadAttachments(questionId); }, [homework.id, questionId]);

  return <section className="workspace-pane attachment-pane">
    <div className="workspace-intro"><Upload size={22} /><div><strong>题目附件</strong><p>为指定题目补充图片或文档。整份作业最多 5 个附件，学生作答时可下载查看。</p></div></div>
    <label className="field-block">选择题目
      <select value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
        {questions.map((item) => <option key={item.id} value={item.id}>{item.sortOrder}. {item.stem}</option>)}
      </select>
    </label>
    <QuestionAttachmentPanel
      homework={homework}
      questionId={questionId}
      attachments={attachments}
      summary={summary}
      notify={notify}
      onChanged={async () => { await Promise.all([loadSummary(), loadAttachments(questionId)]); }}
    />
  </section>;
}

function SubmissionEditor({ homework, notify }) {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [grade, setGrade] = useState({ score: "", feedback: "" });
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("请修改后重新提交");
  const [returning, setReturning] = useState(false);

  async function load() {
    try {
      const [page, directory] = await Promise.all([
        homeworksApi.submissions(homework.id, 1, 100),
        usersApi.students().catch(() => []),
      ]);
      const list = page?.items || [];
      setItems(list);
      setStudents(directory || []);
      if (selectedId && !list.some((item) => String(item.studentUserId) === String(selectedId))) {
        setSelectedId("");
        setSelected(null);
        setHistory([]);
      }
    } catch (error) { notify(error.message, "error"); }
  }

  useEffect(() => { load(); }, [homework.id]);

  async function openSubmission(studentUserId) {
    setSelectedId(String(studentUserId || ""));
    setReturnOpen(false);
    if (!studentUserId) {
      setSelected(null);
      setHistory([]);
      setGrade({ score: "", feedback: "" });
      return;
    }
    setLoadingDetail(true);
    try {
      const detail = await homeworksApi.submissionDetail(homework.id, studentUserId);
      setSelected(detail);
      setHistory([]);
      setGrade({ score: detail.submission.score ?? "", feedback: detail.submission.feedback || "" });
      setReturnNote(detail.submission.feedback || "请修改后重新提交");
    } catch (error) {
      notify(error.message, "error");
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadHistory() {
    if (!selected) return;
    try { setHistory(await homeworksApi.gradeHistory(homework.id, selected.submission.studentUserId)); }
    catch (error) { notify(error.message, "error"); }
  }

  function openReturnDialog() {
    if (!selected) return;
    setReturnNote(selected.submission.feedback || "请修改后重新提交");
    setReturnOpen(true);
  }

  async function confirmReturn(event) {
    event.preventDefault();
    if (!selected) return;
    setReturning(true);
    try {
      const updated = await homeworksApi.returnSubmission(homework.id, {
        studentUserId: selected.submission.studentUserId,
        feedback: returnNote.trim() || "请修改后重新提交",
        expectedVersion: selected.submission.version,
      });
      notify("已退回，学生可重新提交");
      setReturnOpen(false);
      setSelected((current) => current ? { ...current, submission: updated } : current);
      setGrade({ score: "", feedback: updated.feedback || "" });
      await load();
    } catch (error) { notify(error.message, "error"); }
    finally { setReturning(false); }
  }

  async function gradeAnswer(answer, answerGrade) {
    try {
      const detail = await homeworksApi.gradeAnswer(
        homework.id,
        selected.submission.studentUserId,
        answer.questionId,
        {
          score: Number(answerGrade.score),
          feedback: answerGrade.feedback,
          expectedSubmissionVersion: selected.submission.version,
        },
      );
      setSelected(detail);
      notify("单题评分已保存");
      await load();
    } catch (error) { notify(error.message, "error"); }
  }

  async function saveGrade(event) {
    event.preventDefault();
    try {
      await homeworksApi.grade(homework.id, {
        studentUserId: selected.submission.studentUserId,
        score: Number(grade.score),
        feedback: grade.feedback,
        expectedVersion: selected.submission.version,
      });
      notify("批改结果已保存");
      await load();
      await openSubmission(selected.submission.studentUserId);
    } catch (error) { notify(error.message, "error"); }
  }

  const studentName = (studentUserId) => {
    const student = students.find((item) => String(item.id) === String(studentUserId));
    if (!student) return `学生 #${studentUserId}`;
    return `${student.nickname || student.username} (#${studentUserId})`;
  };

  const selectedMeta = items.find((item) => String(item.studentUserId) === String(selectedId));

  return (
    <section className="workspace-pane grading-workspace">
      <div className="grading-toolbar">
        <label className="grading-student-pick">
          <span>选择学生提交</span>
          <select
            value={selectedId}
            onChange={(event) => openSubmission(event.target.value)}
            aria-label="选择学生提交"
          >
            <option value="">请先选择一位学生</option>
            {items.map((item) => (
              <option key={item.id || item.studentUserId} value={item.studentUserId}>
                {studentName(item.studentUserId)}
                {` · ${submissionStatusLabel(item.status)}`}
                {item.score != null ? ` · ${item.score} 分` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grading-toolbar-actions">
          {selectedMeta && (
            <span className="grading-submit-meta">
              提交于 {formatTime(selectedMeta.submittedTime)}
            </span>
          )}
          <button className="icon-button" type="button" title="刷新提交列表" onClick={load}>
            <RefreshCw size={17} />
          </button>
        </div>
      </div>

      {!items.length && <p className="grading-empty">暂无学生提交</p>}
      {items.length > 0 && !selectedId && <p className="grading-empty">请先在上方选择要批改的学生</p>}
      {loadingDetail && <p className="grading-empty">正在加载作答详情...</p>}

      {selected && !loadingDetail && (
        <form className="submission-grade" onSubmit={saveGrade}>
          <header className="grading-header">
            <div>
              <strong>{studentName(selected.submission.studentUserId)}</strong>
              <small>版本 {selected.submission.version} · {submissionStatusLabel(selected.submission.status)}</small>
            </div>
            <div className="inline-actions">
              <button className="button ghost compact" type="button" onClick={loadHistory}>批改历史</button>
              {selected.submission.status !== "RETURNED" && (
                <button className="button ghost compact" type="button" onClick={openReturnDialog}>退回重做</button>
              )}
            </div>
          </header>

          {!selected.answers?.length && (
            <p className="lesson-text grading-plain-answer">{selected.submission.answerContent || "未填写正文"}</p>
          )}

          <div className="answer-review">
            {selected.answers?.length
              ? selected.answers.map((answer, index) => (
                <AnswerGradeRow
                  key={answer.questionId}
                  index={index + 1}
                  answer={answer}
                  onSave={(answerGrade) => gradeAnswer(answer, answerGrade)}
                />
              ))
              : null}
          </div>

          {history.length > 0 && (
            <section className="grade-history">
              <strong>批改历史</strong>
              {history.map((item, index) => (
                <p key={item.id || index}>
                  <span>{item.score} 分 · {item.feedback || "无反馈"}</span>
                  <small>{formatTime(item.createdTime || item.gradedTime)}</small>
                </p>
              ))}
            </section>
          )}

          <div className="grading-total-bar">
            <label className="grading-total-score">
              <span>整份总分</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={grade.score}
                onChange={(event) => setGrade({ ...grade, score: event.target.value })}
                required
              />
              <em>/ 100</em>
            </label>
            <label className="grading-total-feedback">
              <span>整份反馈（可选）</span>
              <input
                value={grade.feedback}
                maxLength={2000}
                placeholder="简要评语"
                onChange={(event) => setGrade({ ...grade, feedback: event.target.value })}
              />
            </label>
            <button className="button primary" type="submit"><Save size={16} />保存整份批改</button>
          </div>
        </form>
      )}

      {returnOpen && selected && (
        <Modal
          title="退回重做"
          description={`将退回「${studentName(selected.submission.studentUserId)}」的提交，学生可按说明修改后重新提交。`}
          onClose={() => !returning && setReturnOpen(false)}
          width={520}
          layer={160}
        >
          <form className="material-confirm return-confirm" onSubmit={confirmReturn}>
            <label>
              退回原因（学生可见）
              <textarea
                value={returnNote}
                maxLength={2000}
                rows={4}
                placeholder="说明需要修改的地方"
                onChange={(event) => setReturnNote(event.target.value)}
                required
              />
            </label>
            <div className="confirm-actions">
              <button className="button ghost" type="button" disabled={returning} onClick={() => setReturnOpen(false)}>取消</button>
              <button className="button primary" type="submit" disabled={returning || !returnNote.trim()}>
                {returning ? "退回中..." : "确认退回"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function AnswerGradeRow({ index, answer, onSave }) {
  const [form, setForm] = useState({
    score: answer.manualScore ?? answer.finalScore ?? "",
    feedback: answer.feedback || "",
    showFeedback: Boolean(answer.feedback),
  });

  useEffect(() => {
    setForm({
      score: answer.manualScore ?? answer.finalScore ?? "",
      feedback: answer.feedback || "",
      showFeedback: Boolean(answer.feedback),
    });
  }, [answer.questionId, answer.manualScore, answer.finalScore, answer.feedback]);

  const currentScore = form.score === "" ? null : Number(form.score);
  const scored = currentScore != null && Number.isFinite(currentScore);
  const fullScore = scored && currentScore >= Number(answer.maxScore);
  const scoreTone = !scored ? "" : fullScore ? "is-full" : "is-partial";

  return (
    <article className={`answer-grade-card${scored ? " is-scored" : ""}${fullScore ? " is-full-score" : scored ? " is-partial-score" : ""}`}>
      <header className="answer-grade-head">
        <div className="answer-grade-title">
          <span className="answer-grade-index">第 {index} 题</span>
          <strong>{answer.stem}</strong>
        </div>
        <div className={`answer-score-badge${scored ? " filled" : ""} ${scoreTone}`.trim()}>
          <strong>{scored ? currentScore : (answer.finalScore ?? "—")}</strong>
          <span>/ {answer.maxScore} 分</span>
        </div>
      </header>
      <p className="answer-student-reply">{answer.answerText || answer.selectedAnswers?.join("、") || "未作答"}</p>
      <div className="answer-grade-controls">
        <label className={`answer-score-field ${scoreTone}`.trim()}>
          <span>得分</span>
          <input
            aria-label={`第 ${index} 题得分`}
            type="number"
            min="0"
            max={answer.maxScore}
            step="0.01"
            value={form.score}
            onChange={(event) => setForm({ ...form, score: event.target.value })}
          />
          <em>满分 {answer.maxScore}</em>
        </label>
        <button
          className="button ghost compact"
          type="button"
          onClick={() => setForm({ ...form, showFeedback: !form.showFeedback })}
        >
          {form.showFeedback ? "收起反馈" : (form.feedback ? "编辑反馈" : "添加反馈")}
        </button>
        <button
          className="button primary compact"
          type="button"
          disabled={form.score === ""}
          onClick={() => onSave({ score: form.score, feedback: form.feedback })}
        >
          保存本题
        </button>
      </div>
      {form.showFeedback && (
        <input
          className="answer-feedback-input"
          aria-label={`第 ${index} 题反馈`}
          value={form.feedback}
          placeholder="可选：一句话反馈"
          onChange={(event) => setForm({ ...form, feedback: event.target.value })}
        />
      )}
      <small className="answer-grade-status">{answer.gradingStatus || "待批改"}</small>
    </article>
  );
}

function ChoiceOptionsEditor({ multiple, options = [], correctAnswers = [], onChange }) {
  const safeOptions = Array.isArray(options) ? options : [];
  const safeAnswers = Array.isArray(correctAnswers) ? correctAnswers : [];
  const selected = new Set(safeAnswers);

  function updateOption(index, content) {
    const next = safeOptions.map((option, i) => (i === index ? { ...option, content } : option));
    onChange({ options: next });
  }

  function addOption() {
    if (safeOptions.length >= OPTION_KEYS.length) return;
    const key = OPTION_KEYS[safeOptions.length];
    onChange({ options: [...safeOptions, { key, content: "" }] });
  }

  function removeOption(index) {
    if (safeOptions.length <= 2) return;
    const next = safeOptions
      .filter((_, i) => i !== index)
      .map((option, i) => ({ key: OPTION_KEYS[i], content: option.content }));
    const remapped = safeAnswers
      .map((key) => {
        const oldIndex = safeOptions.findIndex((option) => option.key === key);
        if (oldIndex < 0 || oldIndex === index) return null;
        return OPTION_KEYS[oldIndex > index ? oldIndex - 1 : oldIndex];
      })
      .filter(Boolean);
    onChange({ options: next, correctAnswers: remapped });
  }

  function toggleCorrect(key) {
    if (multiple) {
      const next = selected.has(key)
        ? safeAnswers.filter((value) => value !== key)
        : [...safeAnswers, key];
      onChange({ correctAnswers: next });
      return;
    }
    onChange({ correctAnswers: [key] });
  }

  return (
    <div className="choice-options-editor">
      <div className="choice-options-head">
        <strong>选项与正确答案</strong>
        <small>{multiple ? "勾选一个或多个正确答案" : "点选唯一正确答案"}</small>
      </div>
      <div className="choice-option-list">
        {safeOptions.map((option, index) => (
          <div className={`choice-option-row${selected.has(option.key) ? " is-correct" : ""}`} key={option.key}>
            <label className="choice-correct-pick" title="设为正确答案">
              <input
                type={multiple ? "checkbox" : "radio"}
                name="choice-correct-answer"
                checked={selected.has(option.key)}
                onChange={() => toggleCorrect(option.key)}
              />
              <span className="choice-key">{option.key}</span>
            </label>
            <input
              className="choice-content-input"
              value={option.content}
              maxLength={500}
              required
              placeholder={`选项 ${option.key} 内容`}
              onChange={(event) => updateOption(index, event.target.value)}
            />
            <button
              className="icon-button danger"
              type="button"
              title="删除选项"
              disabled={safeOptions.length <= 2}
              onClick={() => removeOption(index)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="choice-options-actions">
        <button className="button ghost compact" type="button" disabled={safeOptions.length >= OPTION_KEYS.length} onClick={addOption}>
          <Plus size={15} />添加选项
        </button>
        <span className="choice-correct-hint">
          已选答案：{safeAnswers.length ? safeAnswers.join("、") : "未选择"}
        </span>
      </div>
    </div>
  );
}

function toQuestionPayload(form) {
  const type = String(form.type || "SHORT_ANSWER");
  const options = type.includes("CHOICE")
    ? (Array.isArray(form.options) ? form.options : [])
      .map((option, index) => ({
        key: option.key || OPTION_KEYS[index],
        content: String(option.content || "").trim(),
        sortOrder: index + 1,
      }))
      .filter((option) => option.content)
    : [];
  return {
    type,
    stem: form.stem,
    score: Number(form.score),
    sortOrder: Number(form.sortOrder),
    options,
    correctAnswers: Array.isArray(form.correctAnswers) ? form.correctAnswers : [],
    referenceAnswer: form.referenceAnswer || null,
    analysis: form.analysis || null,
  };
}
function questionType(type) { return ({ SHORT_ANSWER: "简答题", SINGLE_CHOICE: "单选题", MULTIPLE_CHOICE: "多选题", TRUE_FALSE: "判断题" })[type] || type; }
function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
function submissionStatusLabel(status) {
  return ({
    SUBMITTED: "已提交",
    PENDING_GRADING: "批改中",
    GRADED: "已完成",
    RETURNED: "已退回",
  })[status] || status || "-";
}
function homeworkStatus(status) {
  return ({
    DRAFT: { label: "草稿", tone: "pending" },
    PUBLISHED: { label: "已发布", tone: "enabled" },
    CLOSED: { label: "已关闭", tone: "disabled" },
  })[status] || { label: status || "未知", tone: "pending" };
}
