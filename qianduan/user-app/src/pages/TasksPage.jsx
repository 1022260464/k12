import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, FileText, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { homeworksApi } from "../api/client.js";

const TASKS_DOODLE = "/assets/tasks-face-doodle.png";

export function TasksPage({ session, requireLogin, navigate }) {
  const [tab, setTab] = useState("全部");
  const [items, setItems] = useState([]);
  const [submissionsByHomework, setSubmissionsByHomework] = useState({});
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  async function load() {
    if (!session) {
      setItems([]);
      setSubmissionsByHomework({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [homeworks, resultsPage] = await Promise.all([
        homeworksApi.list(),
        homeworksApi.learningResults(1, 100).catch(() => ({ items: [] })),
      ]);
      const map = {};
      (resultsPage?.items || resultsPage || []).forEach((item) => {
        if (item?.homeworkId != null) map[item.homeworkId] = item;
      });
      setItems(Array.isArray(homeworks) ? homeworks : (homeworks?.items || []));
      setSubmissionsByHomework(map);
    } catch (requestError) {
      setError(requestError.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [session]);

  const visibleItems = useMemo(() => {
    if (tab === "全部") return items;
    if (tab === "待完成") {
      return items.filter((item) => {
        const submission = submissionsByHomework[item.id];
        return item.status === "PUBLISHED" && (!submission || submission.status === "RETURNED");
      });
    }
    if (tab === "已提交") {
      return items.filter((item) => ["SUBMITTED", "PENDING_GRADING"].includes(submissionsByHomework[item.id]?.status));
    }
    if (tab === "已完成") {
      return items.filter((item) => submissionsByHomework[item.id]?.status === "GRADED" || item.status === "CLOSED");
    }
    return items.filter((item) => item.status === tab);
  }, [items, tab, submissionsByHomework]);

  const counts = {
    todo: items.filter((item) => {
      const submission = submissionsByHomework[item.id];
      return item.status === "PUBLISHED" && (!submission || submission.status === "RETURNED");
    }).length,
    submitted: items.filter((item) => ["SUBMITTED", "PENDING_GRADING"].includes(submissionsByHomework[item.id]?.status)).length,
    done: items.filter((item) => submissionsByHomework[item.id]?.status === "GRADED").length,
  };

  function openHomework(task) {
    if (!session) {
      requireLogin();
      return;
    }
    navigate(`tasks/${task.id}`);
  }

  return (
    <div className="page inner-page">
      <header className="page-title">
        <p className="eyebrow"><ClipboardList size={14} /> 作业练习</p>
        <h1 className="page-title-with-doodle">
          <span>安排好今天的学习任务</span>
          <img className="page-title-doodle page-title-doodle-face" src={TASKS_DOODLE} alt="" width={96} height={96} />
        </h1>
        <p>提交后显示「已提交」，教师批改完成显示「已完成」；退回后可重新提交。</p>
      </header>
      <section className="task-summary">
        <article className="tone-todo"><Clock3 /><div><strong>{counts.todo}</strong><span>待完成</span></div></article>
        <article className="tone-submitted"><CalendarDays /><div><strong>{counts.submitted}</strong><span>已提交</span></div></article>
        <article className="tone-done"><CheckCircle2 /><div><strong>{counts.done}</strong><span>已完成</span></div></article>
      </section>
      <div className="segmented-control" aria-label="作业状态">
        {[["全部", "全部"], ["待完成", "待完成"], ["已提交", "已提交"], ["已完成", "已完成"]].map(([value, label]) => (
          <button className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>
      {!session ? (
        <EmptyTasks title="登录后查看作业" detail="作业与个人提交记录需要登录后读取。" onLogin={() => requireLogin()} />
      ) : loading ? (
        <div className="loading-state"><LoaderCircle size={22} />正在加载作业</div>
      ) : error && !items.length ? (
        <EmptyTasks title="作业加载失败" detail={error} />
      ) : visibleItems.length === 0 ? (
        <EmptyTasks title="暂无作业" detail="当前状态下没有需要处理的作业。" />
      ) : (
        <section className="task-board">
          {visibleItems.map((task) => {
            const submission = submissionsByHomework[task.id];
            const tone = taskStatusTone(task, submission);
            return (
              <article key={task.id} className={`task-row tone-${tone}`}>
                <span className={`task-icon tone-${tone}`}><FileText size={20} /></span>
                <div className="task-copy">
                  <small>课程 #{task.courseId}</small>
                  <h2>{task.title}</h2>
                  <p>{task.description || "暂无作业说明"}</p>
                </div>
                <div className="task-due">
                  <span className={`task-status-badge tone-${tone}`}>
                    {tone === "returned" && <RotateCcw size={12} />}
                    {taskProgressLabel(task, submission)}
                  </span>
                  <small>{formatDate(submission?.submittedTime || task.updatedTime)}</small>
                </div>
                <button className="button secondary compact" type="button" onClick={() => openHomework(task)}>
                  打开作业<ArrowRight size={16} />
                </button>
              </article>
            );
          })}
        </section>
      )}
      {error && items.length > 0 && <p className="page-error">{error}</p>}
    </div>
  );
}

function taskStatusTone(task, submission) {
  if (submission?.status === "RETURNED") return "returned";
  if (submission?.status === "GRADED") return "done";
  if (["SUBMITTED", "PENDING_GRADING"].includes(submission?.status)) return "submitted";
  if (task.status === "CLOSED") return "closed";
  return "todo";
}

function taskProgressLabel(task, submission) {
  if (task.status === "CLOSED" && submission?.status !== "GRADED") return "已结束";
  if (!submission) return task.status === "PUBLISHED" ? "待完成" : (task.status === "CLOSED" ? "已结束" : "待查看");
  return ({
    SUBMITTED: "已提交",
    PENDING_GRADING: "已提交",
    GRADED: submission.score != null ? `已完成 · ${submission.score} 分` : "已完成",
    RETURNED: "可重新提交",
  })[submission.status] || "处理中";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "-";
}

function EmptyTasks({ title, detail, onLogin }) {
  return (
    <section className="empty-state">
      <FileText size={28} />
      <h2>{title}</h2>
      <p>{detail}</p>
      {onLogin && <button className="button primary" type="button" onClick={onLogin}>立即登录</button>}
    </section>
  );
}
