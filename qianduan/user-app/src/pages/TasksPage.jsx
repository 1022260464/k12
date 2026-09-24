import { ArrowRight, BookOpenText, CalendarCheck2, CheckCircle2, Clock3, FileText, LoaderCircle, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, homeworksApi } from "../api/client.js";
import { LearningCalendar } from "../components/LearningCalendar.jsx";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

export function TasksPage({ session, requireLogin, navigate, experience = EXPERIENCE.TEEN }) {
  const [tab, setTab] = useState("全部");
  const [items, setItems] = useState([]);
  const [submissionsByHomework, setSubmissionsByHomework] = useState({});
  const [courseHistory, setCourseHistory] = useState([]);
  const [learningEvents, setLearningEvents] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  async function load() {
    if (!session) {
      setItems([]);
      setSubmissionsByHomework({});
      setCourseHistory([]);
      setLearningEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [homeworks, resultsPage, history, eventPage] = await Promise.all([
        homeworksApi.list(),
        homeworksApi.learningResults(1, 100).catch(() => ({ items: [] })),
        coursesApi.history(20).catch(() => []),
        coursesApi.events(90, 200).catch(() => []),
      ]);
      const map = {};
      (resultsPage?.items || resultsPage || []).forEach((item) => {
        if (item?.homeworkId != null) map[item.homeworkId] = item;
      });
      setItems(Array.isArray(homeworks) ? homeworks : (homeworks?.items || []));
      setSubmissionsByHomework(map);
      setCourseHistory(Array.isArray(history) ? history : (history?.items || []));
      setLearningEvents(Array.isArray(eventPage) ? eventPage : (eventPage?.items || []));
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
  const primary = experience === EXPERIENCE.PRIMARY;
  const visuals = visualsFor(experience);
  const pendingItems = items.filter((item) => {
    const submission = submissionsByHomework[item.id];
    return item.status === "PUBLISHED" && (!submission || submission.status === "RETURNED");
  });
  const nextTask = pendingItems.find((item) => submissionsByHomework[item.id]?.status === "RETURNED") || pendingItems[0];
  const activeCourse = courseHistory.find((item) => Number(item.progressPercent || 0) < 100) || courseHistory[0];
  const averageProgress = courseHistory.length
    ? Math.round(courseHistory.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / courseHistory.length)
    : 0;
  const completionRate = items.length ? Math.round((counts.done / items.length) * 100) : 0;
  const calendarEvents = useMemo(
    () => buildCalendarEvents(items, submissionsByHomework, courseHistory, learningEvents, openHomework, navigate),
    [items, submissionsByHomework, courseHistory, learningEvents, navigate],
  );

  function openHomework(task) {
    if (!session) {
      requireLogin();
      return;
    }
    navigate(`tasks/${task.id}`);
  }

  return (
    <div className={`page inner-page tasks-page ${primary ? "primary-mode" : "teen-mode"}`}>
      <header className="tasks-hero">
        <div className="tasks-hero-copy">
          <p className="eyebrow"><Sparkles size={14} />{primary ? "今日成长挑战" : "LEARNING TASK CENTER"}</p>
          <h1>{primary ? "完成小任务，收集今天的成长星" : "把作业、进度和学习节奏放在一起"}</h1>
          <p>{primary
            ? "先完成老师布置的小挑战，再看看课程有没有新的进步。每次认真提交，都会留下成长记录。"
            : "统一查看待办、提交状态与课程进度。日历记录作业动态，帮助你安排下一段学习时间。"}</p>
          <div className="tasks-hero-actions">
            <button className="button primary" type="button" onClick={() => nextTask ? openHomework(nextTask) : navigate("courses")}>
              {nextTask ? (primary ? "开始今日挑战" : "处理下一项作业") : "继续学习课程"}<ArrowRight size={16} />
            </button>
            <span><CalendarCheck2 size={16} />{counts.todo ? `${counts.todo} 项等待完成` : "今天没有未完成作业"}</span>
          </div>
        </div>
        <div className="tasks-hero-art" aria-hidden="true">
          <span>{primary ? "一步一步来，你正在变得更厉害" : "保持节奏，比临时突击更有效"}</span>
          <img src={visuals.tasks} alt="" />
        </div>
      </header>

      <section className="task-summary">
        <article className="tone-todo"><Clock3 /><div><strong>{counts.todo}</strong><span>待完成</span></div></article>
        <article className="tone-submitted"><CalendarCheck2 /><div><strong>{counts.submitted}</strong><span>等待批改</span></div></article>
        <article className="tone-done"><CheckCircle2 /><div><strong>{counts.done}</strong><span>已完成</span></div></article>
        <article className="tone-progress"><TrendingUp /><div><strong>{averageProgress}%</strong><span>课程平均进度</span></div></article>
      </section>

      <section className="tasks-workspace">
        <div className="tasks-main-panel">
          <header className="tasks-panel-heading">
            <div><small>{primary ? "我的任务盒" : "ASSIGNMENTS"}</small><h2>{primary ? "选一个任务开始吧" : "作业清单"}</h2></div>
            <div className="segmented-control" aria-label="作业状态">
              {[["全部", "全部"], ["待完成", "待完成"], ["已提交", "已提交"], ["已完成", "已完成"]].map(([value, label]) => (
                <button className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{label}</button>
              ))}
            </div>
          </header>
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
        </div>

        <aside className="tasks-sidebar">
          <LearningCalendar events={calendarEvents} />
          <section className="task-widget task-progress-widget">
            <header className="task-widget-heading">
              <span><BookOpenText size={18} /></span>
              <div><strong>{primary ? "继续我的探索" : "课程进度"}</strong><small>与课程学习记录实时同步</small></div>
            </header>
            {activeCourse ? <>
              <div className="task-course-progress"><strong>{activeCourse.courseTitle || "正在学习的课程"}</strong><span>{Number(activeCourse.progressPercent || 0)}%</span></div>
              <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(activeCourse.progressPercent || 0)))}%` }} /></div>
              <button type="button" onClick={() => navigate(`courses/${activeCourse.courseId}`)}>继续课程<ArrowRight size={15} /></button>
            </> : <p className="task-widget-empty">报名课程后，这里会显示最近的学习进度。</p>}
          </section>
          <section className="task-widget task-rhythm-widget">
            <header><span>{completionRate}%</span><div><strong>{primary ? "成长能量" : "作业完成率"}</strong><small>{counts.done}/{items.length || 0} 项已形成完整反馈</small></div></header>
            <div className="task-rhythm-meter"><i style={{ width: `${completionRate}%` }} /></div>
            <button type="button" onClick={() => navigate("progress")}>{primary ? "查看成长记录" : "打开学习报告"}<ArrowRight size={15} /></button>
          </section>
        </aside>
      </section>
      {error && items.length > 0 && <p className="page-error">{error}</p>}
    </div>
  );
}

function buildCalendarEvents(items, submissionsByHomework, courseHistory, learningEvents, openHomework, navigate) {
  const events = [];
  items.forEach((task) => {
    if (task.updatedTime) {
      events.push({
        id: `task-${task.id}`,
        date: task.updatedTime,
        title: task.title,
        detail: task.status === "PUBLISHED" ? "作业已发布或更新" : "作业状态发生变化",
        tone: taskStatusTone(task, submissionsByHomework[task.id]),
        onOpen: () => openHomework(task),
      });
    }
    const submission = submissionsByHomework[task.id];
    const submissionTime = submission?.submittedTime || submission?.updatedTime;
    if (!learningEvents.length && submissionTime) {
      events.push({
        id: `submission-${task.id}-${submission.status}`,
        date: submissionTime,
        title: task.title,
        detail: taskProgressLabel(task, submission),
        tone: taskStatusTone(task, submission),
        onOpen: () => openHomework(task),
      });
    }
  });
  if (learningEvents.length) {
    learningEvents.forEach((event) => {
      events.push({
        id: `learning-event-${event.id}`,
        date: event.occurredTime,
        title: event.title || "学习动态",
        detail: event.detail || "完成一次有效学习行为",
        tone: eventTone(event.eventType),
        onOpen: () => navigate(eventRoute(event)),
      });
    });
  } else courseHistory.forEach((course) => {
    if (!course.lastLearningTime) return;
    events.push({
      id: `course-${course.courseId}-${course.lastLearningTime}`,
      date: course.lastLearningTime,
      title: course.courseTitle || "课程学习",
      detail: `课程进度 ${Number(course.progressPercent || 0)}%`,
      tone: "course",
      onOpen: () => navigate(`courses/${course.courseId}`),
    });
  });
  return events;
}

function eventRoute(event) {
  if (event.courseId) return `courses/${event.courseId}`;
  if (event.sourceType === "HOMEWORK") return `tasks/${event.sourceId}`;
  if (event.sourceType === "VISUAL_MISSION") return "visual-code-lab";
  if (event.sourceType === "PRACTICE") return "ai-studio";
  return "progress";
}

function eventTone(type) {
  if (type === "HOMEWORK_GRADED" || type === "VISUAL_MISSION_COMPLETED") return "done";
  if (type === "HOMEWORK_SUBMITTED" || type === "PRACTICE_COMPLETED") return "submitted";
  if (type === "COURSE_PROGRESS") return "course";
  return "todo";
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
