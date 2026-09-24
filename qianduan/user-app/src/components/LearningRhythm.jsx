import { ArrowRight, BookOpenCheck, CalendarDays, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, homeworksApi, practiceApi } from "../api/client.js";
import { buildLearningActivity } from "../data/learningActivity.js";
import { EXPERIENCE } from "../experience/experience.js";

export function LearningRhythm({
  session,
  navigate,
  experience = EXPERIENCE.TEEN,
  history: suppliedHistory,
  results: suppliedResults,
  className = "",
}) {
  const [history, setHistory] = useState(suppliedHistory || []);
  const [results, setResults] = useState(suppliedResults || []);
  const [attempts, setAttempts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(Boolean(session && suppliedHistory === undefined));

  useEffect(() => {
    if (suppliedHistory !== undefined) setHistory(suppliedHistory || []);
  }, [suppliedHistory]);

  useEffect(() => {
    if (suppliedResults !== undefined) setResults(suppliedResults || []);
  }, [suppliedResults]);

  useEffect(() => {
    if (!session) {
      setHistory([]);
      setResults([]);
      setAttempts([]);
      setEvents([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    const requests = [
      suppliedHistory === undefined ? coursesApi.history(20) : Promise.resolve(suppliedHistory),
      suppliedResults === undefined ? homeworksApi.learningResults(1, 40) : Promise.resolve(suppliedResults),
      practiceApi.recent(20).catch(() => []),
      coursesApi.events(30, 200).catch(() => []),
    ];
    setLoading(true);
    Promise.all(requests)
      .then(([historyValue, resultsValue, attemptsValue, eventsValue]) => {
        if (!active) return;
        setHistory(historyValue?.items || historyValue || []);
        setResults(resultsValue?.items || resultsValue || []);
        setAttempts(attemptsValue?.items || attemptsValue || []);
        setEvents(eventsValue?.items || eventsValue || []);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, suppliedHistory, suppliedResults]);

  const summary = useMemo(() => buildLearningActivity({ events, history, results, attempts }), [events, history, results, attempts]);
  const primary = experience === EXPERIENCE.PRIMARY;

  return (
    <section className={`learning-rhythm ${primary ? "primary-mode" : "teen-mode"} ${className}`.trim()}>
      <header>
        <div>
          <p className="eyebrow"><Sparkles size={14} />{primary ? "我的探索足迹" : "本周学习节奏"}</p>
          <h2>{primary ? "每一次认真学习，都会亮起一颗星" : "最近 7 天的有效学习记录"}</h2>
          <p>{primary ? "完成课程、练习或作业后，这里会留下成长足迹。" : "数据来自课程进度、AI 小测和作业提交，不把单纯浏览计作完成。"}</p>
        </div>
        <div className="learning-rhythm-metrics">
          <span><strong>{summary.activeDays}</strong><small>活跃天数</small></span>
          <span><strong>{summary.weeklyEvents}</strong><small>学习动态</small></span>
          <span><strong>{summary.todayEvents}</strong><small>今日记录</small></span>
        </div>
      </header>

      {loading ? (
        <div className="learning-rhythm-loading"><LoaderCircle className="spin" size={20} />正在同步学习记录</div>
      ) : (
        <div className="learning-rhythm-body">
          <div className="learning-week" aria-label="最近七天学习记录">
            {summary.days.map((day) => (
              <div className={`${day.count ? "active" : ""} ${day.isToday ? "today" : ""}`} key={day.key} title={`${day.dateLabel}：${day.count} 条学习动态`}>
                <span>{day.label}</span>
                <i>{day.count ? <Sparkles size={14} /> : null}</i>
                <small>{day.dateLabel}</small>
              </div>
            ))}
          </div>
          <aside className="learning-latest">
            <span><BookOpenCheck size={20} /></span>
            {summary.latest ? <div><small>最近一次</small><strong>{summary.latest.title}</strong><p>{summary.latest.detail} · {formatTime(summary.latest.time)}</p></div>
              : <div><small>还没有有效记录</small><strong>{primary ? "从一次小探索开始吧" : "开始第一段学习"}</strong><p>完成章节、练习或作业后会自动同步。</p></div>}
            <button type="button" title={summary.latest ? "打开最近学习内容" : "浏览课程"} onClick={() => navigate(summary.latest?.route || "courses")}>
              {summary.latest ? <ArrowRight size={17} /> : <CalendarDays size={17} />}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
