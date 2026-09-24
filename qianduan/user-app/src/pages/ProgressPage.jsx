import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck, LoaderCircle, MessageSquareText, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, homeworksApi, practiceApi, profileApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { LearnerKnowledgeNetwork } from "../components/LearnerKnowledgeNetwork.jsx";
import { LearningRhythm } from "../components/LearningRhythm.jsx";
import { EXPERIENCE } from "../experience/experience.js";

const stages = [["PRIMARY_LOWER", "小学低年级"], ["PRIMARY_UPPER", "小学高年级"], ["JUNIOR_HIGH", "初中"], ["SENIOR_HIGH", "高中"]];
function ProgressHeader({ experience }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  return (
    <ExperiencePageHeader
      experience={experience}
      eyebrow={primary ? "我的成长" : "学习报告"}
      title={primary ? "看看今天又收获了什么" : "看见每一步进步"}
      description={primary
        ? "课程、挑战和小测都会变成成长记录，帮助你找到下一次探索的方向。"
        : "汇总课程进度、作业结果和 AI 课堂小测。学段、年级等档案请在个人中心维护。"}
      imageKey="progress"
    />
  );
}

export function ProgressPage({ session, requireLogin, navigate, onOpenProfile, onPractice, practiceRevision, experience = EXPERIENCE.TEEN }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState([]);
  const [practiceInsights, setPracticeInsights] = useState([]);
  const [knowledgeMastery, setKnowledgeMastery] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

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
          setProfile(profileResult.value);
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

  if (!session) return <div className="page inner-page"><ProgressHeader experience={experience} /><section className="empty-state"><BarChart3 size={28} /><h2>{experience === EXPERIENCE.PRIMARY ? "登录后查看成长记录" : "登录后查看学习报告"}</h2><p>学习档案和作业结果属于个人数据，需要登录后读取。</p><button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button></section></div>;
  if (loading) return <div className="page inner-page"><div className="loading-state"><LoaderCircle size={22} />正在生成学习报告</div></div>;

  return (
    <div className="page inner-page">
      <ProgressHeader experience={experience} />
      {error && <p className="page-error" role="alert">{error}</p>}
      <section className="report-stats"><article><span><BookOpen /></span><div><strong>{metrics.courses} 门</strong><small>在学课程</small></div></article><article><span><CheckCircle2 /></span><div><strong>{metrics.completedChapters}/{metrics.totalChapters}</strong><small>已完成章节</small></div></article><article><span><TrendingUp /></span><div><strong>{metrics.averageProgress}%</strong><small>平均课程进度</small></div></article><article><span><ClipboardCheck /></span><div><strong>{metrics.averageScore == null ? "暂无" : `${metrics.averageScore} 分`}</strong><small>已批改作业均分</small></div></article></section>

      <LearningRhythm session={session} navigate={navigate} experience={experience} history={history} results={results} className="report-learning-rhythm" />

      <LearnerKnowledgeNetwork
        mastery={knowledgeMastery}
        history={history}
        navigate={navigate}
        onPractice={onPractice}
        experience={experience}
      />

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
          <section className="profile-card">
            <BookOpen />
            <div>
              <small>学习档案</small>
              <h2>{profile?.grade ? `${profile.grade} 年级` : "档案未完善"}</h2>
              <p>{profile ? [stages.find(([value]) => value === profile.schoolStage)?.[1], profile.textbook, profile.interests?.join("、")].filter(Boolean).join(" · ") || "可在个人中心完善学段、教材和兴趣" : "完善学段、教材和兴趣后，AI 会使用这些信息调整回答。"}</p>
              {navigate && (
                <button className="text-button" type="button" onClick={() => onOpenProfile?.()}>
                  打开个人中心编辑
                </button>
              )}
            </div>
          </section>
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
          <section className="result-list">
            <div><small>提交记录</small><h2>最近作业结果</h2></div>
            {results.slice(0, 5).map((item) => {
              const tone = submissionTone(item.status);
              return (
                <p key={item.id}>
                  <span>{item.homeworkTitle || "最近一次作业"}</span>
                  <strong className={`task-status-badge tone-${tone}`}>{formatSubmissionStatus(item)}</strong>
                </p>
              );
            })}
            {!results.length && <p className="inline-empty">暂无作业提交记录。</p>}
          </section>
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
  if (item.status === "GRADED") return item.score == null ? "已完成" : `已完成 · ${item.score} 分`;
  return ({
    SUBMITTED: "已提交",
    PENDING_GRADING: "已提交",
    RETURNED: "可重新提交",
    DRAFT: "未提交",
  })[item.status] || "处理中";
}

function submissionTone(status) {
  if (status === "RETURNED") return "returned";
  if (status === "GRADED") return "done";
  if (["SUBMITTED", "PENDING_GRADING"].includes(status)) return "submitted";
  if (status === "DRAFT") return "todo";
  return "closed";
}
