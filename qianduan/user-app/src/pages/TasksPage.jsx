import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, LoaderCircle, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { homeworksApi } from "../api/client.js";

export function TasksPage({ session, requireLogin }) {
  const [tab, setTab] = useState("全部");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answerContent, setAnswerContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session) { setItems([]); setLoading(false); return; }
    setLoading(true);
    homeworksApi.list().then(setItems).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [session]);

  const visibleItems = useMemo(() => tab === "全部" ? items : items.filter((item) => item.status === tab), [items, tab]);
  const counts = { pending: items.filter((item) => item.status !== "CLOSED").length, published: items.filter((item) => item.status === "PUBLISHED").length, completed: items.filter((item) => item.status === "CLOSED").length };

  async function openHomework(homework) {
    if (!session) { requireLogin(); return; }
    setSelected(homework);
    setQuestions([]);
    setAnswerContent("");
    try { setQuestions(await homeworksApi.questions(homework.id)); }
    catch (requestError) { setError(requestError.message); }
  }

  async function submitHomework(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await homeworksApi.submit(selected.id, { answerContent, answers: [] });
      setSelected(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="page inner-page">
      <header className="page-title"><p className="eyebrow">作业练习</p><h1>安排好今天的学习任务</h1><p>作业、题目和提交状态均从 Assessment Service 实时读取。</p></header>
      <section className="task-summary"><article><Clock3 /><div><strong>{counts.pending}</strong><span>待处理</span></div></article><article><CalendarDays /><div><strong>{counts.published}</strong><span>已发布</span></div></article><article><CheckCircle2 /><div><strong>{counts.completed}</strong><span>已关闭</span></div></article></section>
      <div className="segmented-control" aria-label="作业状态">{[["全部", "全部"], ["PUBLISHED", "待完成"], ["DRAFT", "草稿"], ["CLOSED", "已结束"]].map(([value, label]) => <button className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
      {!session ? <EmptyTasks title="登录后查看作业" detail="作业与个人提交记录需要登录后读取。" onLogin={() => requireLogin()} /> : loading ? <div className="loading-state"><LoaderCircle size={22} />正在加载作业</div> : error && !items.length ? <EmptyTasks title="作业加载失败" detail={error} /> : visibleItems.length === 0 ? <EmptyTasks title="暂无作业" detail="当前状态下没有需要处理的作业。" /> : <section className="task-board">{visibleItems.map((task) => <article key={task.id}><span className="task-icon"><FileText size={20} /></span><div className="task-copy"><small>课程 #{task.courseId}</small><h2>{task.title}</h2><p>{task.description || "暂无作业说明"}</p></div><div className="task-due"><span>{statusLabel(task.status)}</span><small>{formatDate(task.updatedTime)}</small></div><button className="icon-button" type="button" title="打开作业" onClick={() => openHomework(task)}><ArrowRight size={18} /></button></article>)}</section>}
      {error && items.length > 0 && <p className="page-error">{error}</p>}

      {selected && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="作业详情" onMouseDown={(event) => event.stopPropagation()}><header><div><small>{statusLabel(selected.status)}</small><h2>{selected.title}</h2></div><button className="icon-button" type="button" title="关闭" onClick={() => setSelected(null)}><X size={18} /></button></header><p className="drawer-description">{selected.description || "暂无作业说明。"}</p><h3>题目</h3><div className="question-list">{questions.length ? questions.map((question, index) => <article key={question.id}><small>第 {index + 1} 题 · {question.type} · {question.score} 分</small><strong>{question.stem}</strong>{question.options?.map((option) => <span key={option.id}>{option.key}. {option.content}</span>)}</article>) : <p className="inline-empty">该作业尚未配置结构化题目，可使用下方文本提交。</p>}</div>{selected.status === "PUBLISHED" && <form className="submission-form" onSubmit={submitHomework}><label>作答内容<textarea value={answerContent} onChange={(event) => setAnswerContent(event.target.value)} placeholder="输入你的答案或解题过程" required /></label><button className="button primary" type="submit" disabled={submitting}><Send size={17} />{submitting ? "提交中..." : "提交作业"}</button></form>}</aside></div>}
    </div>
  );
}

function statusLabel(status) { return ({ DRAFT: "草稿", PUBLISHED: "待完成", CLOSED: "已结束" })[status] || status; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("zh-CN") : "-"; }
function EmptyTasks({ title, detail, onLogin }) { return <section className="empty-state"><FileText size={28} /><h2>{title}</h2><p>{detail}</p>{onLogin && <button className="button primary" type="button" onClick={onLogin}>立即登录</button>}</section>; }
