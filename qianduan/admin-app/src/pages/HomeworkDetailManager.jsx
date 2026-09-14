import { CheckCircle2, Edit3, Plus, RefreshCw, Save, Search, Trash2, UserCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { homeworksApi, usersApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";

const emptyQuestion = { type: "SHORT_ANSWER", stem: "", score: 10, sortOrder: 1, optionsText: "", correctAnswersText: "", referenceAnswer: "", analysis: "" };

export function HomeworkDetailManager({ homework, notify, onClose }) {
  const [tab, setTab] = useState("recipients");
  return <Modal title={`作业工作台 · ${homework.title}`} description="配置发布对象和题目，并查看学生提交与批改结果。" onClose={onClose} width={1080}>
    <div className="workspace-tabs">{[["recipients", "接收人"], ["questions", "题目"], ["submissions", "提交与批改"]].map(([value, label]) => <button className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "recipients" && <RecipientEditor homework={homework} notify={notify} />}
    {tab === "questions" && <QuestionEditor homework={homework} notify={notify} />}
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
        usersApi.list(),
        homeworksApi.recipients(homework.id),
      ]);
      setStudents((allUsers || []).filter((user) => user.status === "ENABLED" && user.roleCode?.split(",").includes("ROLE_STUDENT")));
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
    return students.filter((student) => [student.username, student.nickname, student.email, student.id]
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
    <div className="student-picker-toolbar"><label className="search-control"><Search size={17} /><input value={query} placeholder="搜索姓名、用户名、邮箱或 ID" onChange={(event) => setQuery(event.target.value)} /></label><label className="select-filtered"><input type="checkbox" checked={allFilteredSelected} disabled={loading || filteredStudents.length === 0} onChange={(event) => event.target.checked ? selectStudents(filteredStudents.map((student) => student.id)) : unselectStudents(filteredStudents.map((student) => student.id))} /><span>全选当前结果（{filteredStudents.length}）</span></label></div>
    <div className="student-check-list" aria-busy={loading}>
      {loading ? <p className="manager-empty">正在加载学生列表...</p> : filteredStudents.length === 0 ? <p className="manager-empty">没有符合条件的启用学生</p> : filteredStudents.map((student) => <label className={selectedSet.has(student.id) ? "student-check-row selected" : "student-check-row"} key={student.id}><input type="checkbox" checked={selectedSet.has(student.id)} onChange={() => toggleStudent(student.id)} /><span className="table-avatar">{(student.nickname || student.username).slice(0, 1)}</span><span className="student-identity"><strong>{student.nickname || student.username}</strong><small>{student.username} · {student.email || "未填写邮箱"}</small></span><code>#{student.id}</code></label>)}
    </div>
    {missingIds.length > 0 && <div className="recipient-warning"><span>已保存的接收人中有 {missingIds.length} 个账号当前不是启用学生：{missingIds.join(", ")}。</span><button className="button ghost compact" type="button" onClick={() => unselectStudents(missingIds)}>移除失效账号</button></div>}
    {validation && <div className="validation-result"><span>有效账号：{validation.validStudentIds?.length || 0}</span><span className={validation.invalidUserIds?.length ? "invalid" : ""}>无效账号：{validation.invalidUserIds?.join(", ") || "无"}</span></div>}
    <div className="workspace-actions"><button className="button ghost" type="button" disabled={!selectedIds.length || saving} onClick={validate}><CheckCircle2 size={16} />校验已选学生</button><button className="button primary" type="button" disabled={!selectedIds.length || saving || missingIds.length > 0 || validation?.invalidUserIds?.length} onClick={save}><Save size={16} />{saving ? "正在保存" : "保存接收人"}</button></div>
  </section>;
}

function QuestionEditor({ homework, notify }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  async function load() { try { setItems(await homeworksApi.questions(homework.id)); } catch (error) { notify(error.message, "error"); } }
  useEffect(() => { load(); }, [homework.id]);
  function create() { setEditing(null); setForm({ ...emptyQuestion, sortOrder: items.length + 1 }); }
  function edit(item) { setEditing(item); setForm({ type: item.type, stem: item.stem, score: item.score, sortOrder: item.sortOrder, optionsText: (item.options || []).map((option) => `${option.key}|${option.content}`).join("\n"), correctAnswersText: (item.correctAnswers || []).join(","), referenceAnswer: item.referenceAnswer || "", analysis: item.analysis || "" }); }
  async function save(event) { event.preventDefault(); const payload = toQuestionPayload(form); try { if (editing) await homeworksApi.updateQuestion(homework.id, editing.id, payload); else await homeworksApi.createQuestion(homework.id, payload); notify(editing ? "题目已更新" : "题目已创建"); create(); await load(); } catch (error) { notify(error.message, "error"); } }
  async function remove(item) { if (!window.confirm("确认删除该题目吗？")) return; try { await homeworksApi.removeQuestion(homework.id, item.id); notify("题目已删除"); await load(); } catch (error) { notify(error.message, "error"); } }
  return <div className="manager-layout question-manager"><section className="manager-list"><header><strong>题目列表</strong><button className="icon-button" type="button" title="刷新题目" onClick={load}><RefreshCw size={17} /></button></header>{items.length ? items.map((item) => <article className={editing?.id === item.id ? "selected" : ""} key={item.id}><div><strong>{item.sortOrder}. {item.stem}</strong><small>{questionType(item.type)} · {item.score} 分</small></div><button className="icon-button" type="button" title="编辑题目" onClick={() => edit(item)}><Edit3 size={15} /></button><button className="icon-button danger" type="button" title="删除题目" onClick={() => remove(item)}><Trash2 size={15} /></button></article>) : <p className="manager-empty">暂无题目，请在右侧创建。</p>}</section><form className="manager-form" onSubmit={save}><header><div><strong>{editing ? "编辑题目" : "新建题目"}</strong><small>选择题选项每行使用“键|内容”。</small></div><button className="button ghost compact" type="button" onClick={create}><Plus size={15} />新建</button></header><label>题型<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{["SHORT_ANSWER", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].map((type) => <option key={type} value={type}>{questionType(type)}</option>)}</select></label><label>题干<textarea className="short" value={form.stem} maxLength={4000} onChange={(event) => setForm({ ...form, stem: event.target.value })} required /></label><div className="field-pair"><label>分值<input type="number" min="0.01" max="100" step="0.01" value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} required /></label><label>排序<input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} required /></label></div>{form.type.includes("CHOICE") && <><label>选项<textarea className="short" value={form.optionsText} placeholder={'A|第一个选项\nB|第二个选项'} onChange={(event) => setForm({ ...form, optionsText: event.target.value })} required /></label><label>正确答案<input value={form.correctAnswersText} placeholder="A 或 A,B" onChange={(event) => setForm({ ...form, correctAnswersText: event.target.value })} required /></label></>}<label>参考答案<textarea className="short" value={form.referenceAnswer} onChange={(event) => setForm({ ...form, referenceAnswer: event.target.value })} /></label><label>解析<textarea className="short" value={form.analysis} onChange={(event) => setForm({ ...form, analysis: event.target.value })} /></label><button className="button primary" type="submit"><Save size={16} />保存题目</button></form></div>;
}

function SubmissionEditor({ homework, notify }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [grade, setGrade] = useState({ score: "", feedback: "" });
  async function load() { try { const page = await homeworksApi.submissions(homework.id, 1, 50); setItems(page?.items || []); } catch (error) { notify(error.message, "error"); } }
  useEffect(() => { load(); }, [homework.id]);
  async function inspect(item) { try { const detail = await homeworksApi.submissionDetail(homework.id, item.studentUserId); setSelected(detail); setHistory([]); setGrade({ score: detail.submission.score ?? "", feedback: detail.submission.feedback || "" }); } catch (error) { notify(error.message, "error"); } }
  async function loadHistory() { try { setHistory(await homeworksApi.gradeHistory(homework.id, selected.submission.studentUserId)); } catch (error) { notify(error.message, "error"); } }
  async function gradeAnswer(answer, answerGrade) { try { const detail = await homeworksApi.gradeAnswer(homework.id, selected.submission.studentUserId, answer.questionId, { score: Number(answerGrade.score), feedback: answerGrade.feedback, expectedSubmissionVersion: selected.submission.version }); setSelected(detail); notify("单题评分已保存"); await load(); } catch (error) { notify(error.message, "error"); } }
  async function saveGrade(event) { event.preventDefault(); try { await homeworksApi.grade(homework.id, { studentUserId: selected.submission.studentUserId, score: Number(grade.score), feedback: grade.feedback, expectedVersion: selected.submission.version }); notify("批改结果已保存"); setSelected(null); await load(); } catch (error) { notify(error.message, "error"); } }
  return <section className="workspace-pane"><div className="manager-table-head"><strong>学生提交</strong><button className="icon-button" type="button" title="刷新提交" onClick={load}><RefreshCw size={17} /></button></div><div className="table-wrap"><table className="responsive-table"><thead><tr><th>学生 ID</th><th>状态</th><th>得分</th><th>提交时间</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={item.id}><td data-label="学生 ID">#{item.studentUserId}</td><td data-label="状态">{item.status}</td><td data-label="得分">{item.score ?? "-"}</td><td data-label="提交时间">{formatTime(item.submittedTime)}</td><td data-label="操作"><button className="button ghost compact" type="button" onClick={() => inspect(item)}>查看并批改</button></td></tr>) : <tr><td colSpan="5" className="empty-cell">暂无学生提交</td></tr>}</tbody></table></div>{selected && <form className="submission-grade" onSubmit={saveGrade}><header><div><strong>学生 #{selected.submission.studentUserId}</strong><small>提交版本 {selected.submission.version}</small></div><div className="inline-actions"><button className="button ghost compact" type="button" onClick={loadHistory}>批改历史</button><button className="button ghost compact" type="button" onClick={() => setSelected(null)}>关闭</button></div></header><div className="answer-review">{selected.answers?.length ? selected.answers.map((answer) => <AnswerGradeRow key={answer.questionId} answer={answer} onSave={(answerGrade) => gradeAnswer(answer, answerGrade)} />) : <p className="manager-empty">该提交没有结构化答案。</p>}</div>{history.length > 0 && <section className="grade-history"><strong>批改历史</strong>{history.map((item, index) => <p key={item.id || index}><span>{item.score} 分 · {item.feedback || "无反馈"}</span><small>{formatTime(item.createdTime || item.gradedTime)}</small></p>)}</section>}<label>总分<input type="number" min="0" max="100" step="0.01" value={grade.score} onChange={(event) => setGrade({ ...grade, score: event.target.value })} required /></label><label>反馈<textarea value={grade.feedback} maxLength={2000} onChange={(event) => setGrade({ ...grade, feedback: event.target.value })} /></label><button className="button primary" type="submit"><Save size={16} />保存整份批改</button></form>}</section>;
}

function AnswerGradeRow({ answer, onSave }) {
  const [form, setForm] = useState({ score: answer.manualScore ?? answer.finalScore ?? "", feedback: answer.feedback || "" });
  return <article><strong>{answer.stem}</strong><p>{answer.answerText || answer.selectedAnswers?.join(", ") || "未作答"}</p><small>{answer.finalScore ?? "待批改"} / {answer.maxScore} 分 · {answer.gradingStatus}</small><div className="answer-grade-controls"><input aria-label="单题得分" type="number" min="0" max={answer.maxScore} step="0.01" value={form.score} onChange={(event) => setForm({ ...form, score: event.target.value })} /><input aria-label="单题反馈" value={form.feedback} placeholder="单题反馈" onChange={(event) => setForm({ ...form, feedback: event.target.value })} /><button className="button ghost compact" type="button" disabled={form.score === ""} onClick={() => onSave(form)}>保存单题</button></div></article>;
}

function toQuestionPayload(form) { const options = form.optionsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => { const [key, ...content] = line.split("|"); return { key: key.trim().toUpperCase(), content: content.join("|").trim(), sortOrder: index + 1 }; }); return { type: form.type, stem: form.stem, score: Number(form.score), sortOrder: Number(form.sortOrder), options, correctAnswers: form.correctAnswersText.split(/[，,\s]+/).map((value) => value.trim().toUpperCase()).filter(Boolean), referenceAnswer: form.referenceAnswer || null, analysis: form.analysis || null }; }
function questionType(type) { return ({ SHORT_ANSWER: "简答题", SINGLE_CHOICE: "单选题", MULTIPLE_CHOICE: "多选题", TRUE_FALSE: "判断题" })[type] || type; }
function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
