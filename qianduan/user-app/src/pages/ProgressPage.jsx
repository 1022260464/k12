import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck, LoaderCircle, MessageSquareText, Pencil, Save, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, homeworksApi, practiceApi, profileApi } from "../api/client.js";

const stages = [["PRIMARY_LOWER", "小学低年级"], ["PRIMARY_UPPER", "小学高年级"], ["JUNIOR_HIGH", "初中"], ["SENIOR_HIGH", "高中"]];

export function ProgressPage({ session, requireLogin, onPractice, practiceRevision }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState([]);
  const [practiceInsights, setPracticeInsights] = useState([]);
  const [knowledgeMastery, setKnowledgeMastery] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ schoolStage: "JUNIOR_HIGH", grade: 7, textbook: "", interests: "" });

  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      setHistory([]);
      setResults([]);
      setPracticeInsights([]);
      setKnowledgeMastery([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError("");
    Promise.allSettled([
      profileApi.getLearningProfile(),
      coursesApi.history(10),
      homeworksApi.learningResults(1, 10),
      practiceApi.insights(),
      practiceApi.mastery(),
    ])
      .then(([profileResult, historyResult, homeworkResult, practiceResult, masteryResult]) => {
        if (!active) return;
        const failedSources = [];

        if (profileResult.status === "fulfilled") {
          const profileData = profileResult.value;
          setProfile(profileData);
          if (profileData) setForm({ ...profileData, interests: (profileData.interests || []).join("、") });
        } else {
          setProfile(null);
          failedSources.push("学习档案");
        }

        if (historyResult.status === "fulfilled") {
          setHistory(historyResult.value?.items || []);
        } else {
          setHistory([]);
          failedSources.push("课程进度");
        }

        if (homeworkResult.status === "fulfilled") {
          setResults(homeworkResult.value?.items || []);
        } else {
          setResults([]);
          failedSources.push("作业结果");
        }

        if (practiceResult.status === "fulfilled") {
          setPracticeInsights(Array.isArray(practiceResult.value) ? practiceResult.value : []);
        } else {
          setPracticeInsights([]);
          failedSources.push("AI 练习建议");
        }

        if (masteryResult.status === "fulfilled") {
          setKnowledgeMastery(Array.isArray(masteryResult.value) ? masteryResult.value : []);
        } else {
          setKnowledgeMastery([]);
          failedSources.push("知识点掌握情况");
        }

        if (failedSources.length) setError(`${failedSources.join("、")}暂时无法读取，已展示其余可用数据。`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, practiceRevision]);

  const metrics = useMemo(() => {
    const graded = results.filter((item) => item.status === "GRADED" && item.score != null);
    const averageScore = graded.length
      ? Math.round(graded.reduce((sum, item) => sum + Number(item.score), 0) / graded.length)
      : null;
    const totalChapters = history.reduce((sum, item) => sum + Number(item.totalChapters || 0), 0);
    const completedChapters = history.reduce((sum, item) => sum + Number(item.completedChapters || 0), 0);
    const averageProgress = history.length
      ? Math.round(history.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / history.length)
      : 0;
    return { courses: history.length, totalChapters, completedChapters, averageProgress, averageScore };
  }, [history, results]);

  const latestGraded = useMemo(
    () => results.find((item) => item.status === "GRADED" && item.score != null),
    [results],
  );

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const saved = await profileApi.updateLearningProfile({ ...form, grade: Number(form.grade), interests: form.interests.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) });
      setProfile(saved);
      setEditing(false);
    } catch (requestError) { setError(requestError.message); }
  }

  if (!session) return <div className="page inner-page"><header className="page-title"><p className="eyebrow">学习报告</p><h1>看见每一步进步</h1></header><section className="empty-state"><BarChart3 size={28} /><h2>登录后查看学习报告</h2><p>学习档案和作业结果属于个人数据，需要登录后读取。</p><button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button></section></div>;
  if (loading) return <div className="page inner-page"><div className="loading-state"><LoaderCircle size={22} />正在生成学习报告</div></div>;

  return (
    <div className="page inner-page">
      <header className="page-title page-title-row"><div><p className="eyebrow">学习报告</p><h1>看见每一步进步</h1><p>汇总课程进度、作业结果和 AI 课堂小测。</p></div><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}><Pencil size={16} />{editing ? "取消编辑" : "编辑学习档案"}</button></header>
      {error && <p className="page-error" role="alert">{error}</p>}
      {editing && <form className="profile-form" onSubmit={saveProfile}><label>学段<select value={form.schoolStage} onChange={(event) => setForm({ ...form, schoolStage: event.target.value })}>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>年级<input type="number" min="1" max="12" value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} required /></label><label>教材<input value={form.textbook} onChange={(event) => setForm({ ...form, textbook: event.target.value })} placeholder="例如：人教版" /></label><label>兴趣<input value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} placeholder="使用顿号分隔" /></label><button className="button primary" type="submit"><Save size={16} />保存档案</button></form>}
      <section className="report-stats"><article><span><BookOpen /></span><div><strong>{metrics.courses} 门</strong><small>在学课程</small></div></article><article><span><CheckCircle2 /></span><div><strong>{metrics.completedChapters}/{metrics.totalChapters}</strong><small>已完成章节</small></div></article><article><span><TrendingUp /></span><div><strong>{metrics.averageProgress}%</strong><small>平均课程进度</small></div></article><article><span><ClipboardCheck /></span><div><strong>{metrics.averageScore == null ? "暂无" : `${metrics.averageScore} 分`}</strong><small>已批改作业均分</small></div></article></section>
      <div className="report-layout">
        <section className="report-panel learning-history-panel">
          <header><div><h2>课程学习进度</h2><p>按最近学习时间排列，只统计当前有效课程。</p></div><strong>{metrics.courses}</strong></header>
          <div className="learning-history-list">
            {history.map((item) => <article key={item.courseId}>
              <div className="learning-history-heading"><div><small>{[item.subject, item.gradeLevel].filter(Boolean).join(" · ") || "课程"}</small><h3>{item.courseTitle}</h3></div><strong>{item.progressPercent}%</strong></div>
              <div className="progress-track" role="progressbar" aria-label={`${item.courseTitle}学习进度`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={item.progressPercent}><span style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }} /></div>
              <footer><span>已完成 {item.completedChapters}/{item.totalChapters} 章</span><span>{item.lastLearningTime ? `最近学习 ${formatDate(item.lastLearningTime)}` : `报名于 ${formatDate(item.enrolledTime)}`}</span></footer>
            </article>)}
            {!history.length && <div className="inline-empty learning-history-empty"><BookOpen size={22} /><span>报名课程并开始学习后，进度会显示在这里。</span></div>}
          </div>
        </section>
        <aside className="report-side">
          <section className="profile-card"><BookOpen /><div><small>学习档案</small><h2>{profile?.grade ? `${profile.grade} 年级` : "档案未完善"}</h2><p>{profile ? [stages.find(([value]) => value === profile.schoolStage)?.[1], profile.textbook, profile.interests?.join("、")].filter(Boolean).join(" · ") || "可编辑学段、教材和兴趣" : "完善学段、教材和兴趣后，AI 会使用这些信息调整回答。"}</p></div></section>
          <section className="practice-insight-panel">
            <ClipboardCheck />
            <div>
              <small>AI 课堂小测</small>
              <h2>接下来学什么</h2>
              {practiceInsights.length ? practiceInsights.slice(0, 3).map((insight) => {
                const mastery = knowledgeMastery.find((item) => item.topic === insight.topic);
                return <article key={insight.topic}>
                  <strong>{insight.topic}</strong>
                  <span>最近 {insight.sampleCount} 次 · 平均 {insight.averageScorePercent}%{mastery ? ` · 累计 ${mastery.attemptCount} 次 / ${mastery.masteryPercent}%` : ""}</span>
                  {mastery && <div className="progress-track" role="progressbar" aria-label={`${insight.topic}练习掌握参考`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={mastery.masteryPercent}><span style={{ width: `${Math.min(100, Math.max(0, mastery.masteryPercent))}%` }} /></div>}
                  <p>{insight.suggestion}</p>
                  <button className="button secondary" type="button" onClick={() => onPractice(insight.topic)}><MessageSquareText size={14} />继续练习</button>
                </article>;
              }) : <p>完成 AI 助教小测后，这里会根据近期练习给出建议。</p>}
              <p className="practice-insight-note">仅反映形成性练习，不是正式成绩或能力评定。</p>
            </div>
          </section>
          <section><BarChart3 /><div><small>最近批改</small><h2>{latestGraded ? `${latestGraded.score} 分` : "暂无已批改作业"}</h2><p>{latestGraded?.feedback || "完成并提交作业后，成绩和教师反馈会显示在这里。"}</p></div></section>
          <section className="result-list"><div><small>提交记录</small><h2>最近作业结果</h2></div>{results.slice(0, 5).map((item) => <p key={item.id}><span>作业 #{item.homeworkId}</span><strong>{formatSubmissionStatus(item)}</strong></p>)}{!results.length && <p className="inline-empty">暂无作业提交记录。</p>}</section>
        </aside>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function formatSubmissionStatus(item) {
  if (item.status === "GRADED") return item.score == null ? "已批改" : `${item.score} 分`;
  return { SUBMITTED: "待批改", DRAFT: "草稿" }[item.status] || item.status || "状态未知";
}
