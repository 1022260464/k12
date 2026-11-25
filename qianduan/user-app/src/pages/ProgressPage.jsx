import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck, FileText, LoaderCircle, MessageSquareText, Sparkles, Target, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, diagnosticsApi, homeworksApi, knowledgeGraphApi, practiceApi, profileApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { AuthGateShowcase } from "../components/AuthGateShowcase.jsx";
import { LearnerKnowledgeNetwork } from "../components/LearnerKnowledgeNetwork.jsx";
import { LearningRhythm } from "../components/LearningRhythm.jsx";
import { PersonalizationLoop } from "../components/PersonalizationLoop.jsx";
import { courseMatchesLearningScope, EXPERIENCE, learningProfileLabel } from "../experience/experience.js";

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

export function ProgressPage({ session, requireLogin, navigate, onOpenProfile, onPractice, practiceRevision, experience = EXPERIENCE.TEEN, activeLearningProfile }) {
  const [profile, setProfile] = useState(activeLearningProfile || null);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState([]);
  const [practiceInsights, setPracticeInsights] = useState([]);
  const [knowledgeMastery, setKnowledgeMastery] = useState([]);
  const [diagnostic, setDiagnostic] = useState(null);
  const [graph, setGraph] = useState(null);
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
      setDiagnostic(null);
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
      diagnosticsApi.latest(),
    ])
      .then(([profileResult, historyResult, homeworkResult, practiceResult, masteryResult, diagnosticResult]) => {
        if (!active) return;
        const failedSources = [];
        const profileValue = profileResult.status === "fulfilled" ? profileResult.value : activeLearningProfile;

        if (profileResult.status === "fulfilled") {
          setProfile(profileValue);
        } else {
          setProfile(profileValue || null);
          failedSources.push("学习档案");
        }

        if (historyResult.status === "fulfilled") {
          const rows = historyResult.value?.items || [];
          setHistory(rows.filter((item) => courseMatchesLearningScope(
            item.gradeLevel,
            profileValue?.schoolStage,
            experience,
          )));
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

        if (diagnosticResult.status === "fulfilled") {
          setDiagnostic(diagnosticResult.value || null);
        } else {
          setDiagnostic(null);
        }

        if (failedSources.length) setError(`${failedSources.join("、")}暂时无法读取，已展示其余可用数据。`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, practiceRevision, experience, activeLearningProfile]);

  // 知识图谱（带本地缓存）：用于给「接下来学什么」补一条可解释的推荐依据（前置/后继关系）。
  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    knowledgeGraphApi.overview()
      .then((data) => { if (active) setGraph(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [session]);

  // 推荐依据（P1-7）：掌握度 + 知识图谱前置/后继 + 学习画像，全部来自真实接口，缺哪环就少说哪环。
  const insightWhy = useMemo(() => {
    const titleByCode = new Map((graph?.points || []).map((point) => [point.code, point.title]));
    const codeByTitle = new Map();
    (graph?.points || []).forEach((point) => {
      if (!codeByTitle.has(point.title)) codeByTitle.set(point.title, point.code);
    });
    const prereqEdges = (graph?.edges || []).filter((edge) => edge.relation === "PREREQUISITE_OF");
    const masteryByCode = new Map(knowledgeMastery.map((item) => [item.knowledgeCode, item]));
    return (insight) => {
      const parts = [];
      const row = knowledgeMastery.find((item) => item.topic === insight.topic);
      if (row) parts.push(`掌握度 ${row.masteryPercent}%${Number(row.masteryPercent) < 80 ? "（低于 80% 巩固线，优先安排）" : "（已达标，可进阶）"}`);
      const code = codeByTitle.get(insight.topic);
      if (code) {
        const weakPre = prereqEdges
          .filter((edge) => edge.toCode === code)
          .map((edge) => masteryByCode.get(edge.fromCode))
          .find((m) => !m || Number(m.masteryPercent) < 60);
        if (weakPre) parts.push(`知识图谱显示先补前置「${weakPre.topic || titleByCode.get(weakPre.knowledgeCode) || "前置知识点"}」`);
        const unlocked = prereqEdges.find((edge) => edge.fromCode === code);
        if (unlocked) parts.push(`学好它才能继续学「${titleByCode.get(unlocked.toCode) || unlocked.toCode}」`);
      }
      if (profile) parts.push(`按学段画像（${learningProfileLabel(profile)}）安排`);
      return parts.join("；");
    };
  }, [graph, knowledgeMastery, profile]);

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

  if (!session) return (
    <div className="page inner-page report-page">
      <ProgressHeader experience={experience} />
      <AuthGateShowcase
        icon={BarChart3}
        title={experience === EXPERIENCE.PRIMARY ? "登录后查看成长记录" : "登录后查看学习报告"}
        description="学习档案和作业结果属于个人数据，需要登录后读取。"
        features={[
          { icon: TrendingUp, title: "课程进度总览", text: "每门课学到哪一章、平均进度多少，一眼看清。" },
          { icon: ClipboardCheck, title: "作业与批改动态", text: "提交状态、得分和老师评语同步展示。" },
          { icon: BookOpen, title: "AI 课堂小测记录", text: "组题练习的每次成绩自动归档成趋势。" },
        ]}
        footnote="学习数据仅自己可见，不会公开展示。"
        onLogin={() => requireLogin()}
      />
    </div>
  );
  if (loading) return <div className="page inner-page report-page"><div className="loading-state"><LoaderCircle size={22} />正在生成学习报告</div></div>;

  return (
    <div className="page inner-page report-page">
      <ProgressHeader experience={experience} />
      {error && <p className="page-error" role="alert">{error}</p>}
      <section className="report-stats"><article><span><BookOpen /></span><div><strong>{metrics.courses} 门</strong><small>在学课程</small></div></article><article><span><CheckCircle2 /></span><div><strong>{metrics.completedChapters}/{metrics.totalChapters}</strong><small>已完成章节</small></div></article><article><span><TrendingUp /></span><div><strong>{metrics.averageProgress}%</strong><small>平均课程进度</small></div></article><article><span><ClipboardCheck /></span><div><strong>{metrics.averageScore == null ? "暂无" : `${metrics.averageScore} 分`}</strong><small>已批改作业均分</small></div></article></section>

      <section className="report-overview-banner" aria-label="当前阶段学习概览">
        <span><TrendingUp size={24} /></span>
        <div>
          <small>{learningProfileLabel(profile)}</small>
          <h2>{metrics.courses ? "你的学习正在形成连续记录" : "从一门适合当前学段的课程开始"}</h2>
          <p>{metrics.courses
            ? `当前阶段已完成 ${metrics.completedChapters} 个章节，平均课程进度 ${metrics.averageProgress}%。继续完成课程、练习和作业，推荐会更加准确。`
            : "课程开始后，这里会汇总进度、练习表现、薄弱知识点和下一步建议。"}</p>
        </div>
        <button className="button secondary" type="button" onClick={() => navigate("courses")}><BookOpen size={16} />查看阶段课程</button>
      </section>

      <PersonalizationLoop
        profile={profile}
        knowledgeMastery={knowledgeMastery}
        practiceInsights={practiceInsights}
        history={history}
        experience={experience}
        onOpenProfile={onOpenProfile}
        onPractice={onPractice}
        navigate={navigate}
      />

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
          {diagnostic ? (
            <section className="profile-card diagnostic-summary-card">
              <Target />
              <div>
                <small>学情画像 · {formatDate(diagnostic.createdTime)}诊断</small>
                <h2>总体掌握 {diagnostic.scorePercent}%</h2>
                <p>{diagnosticSummary(diagnostic)}</p>
                <div className="diagnostic-summary-actions">
                  <button className="text-button" type="button" onClick={() => navigate("diagnostic")}>查看完整画像 / 重新诊断</button>
                </div>
              </div>
            </section>
          ) : (
            <section className="profile-card diagnostic-summary-card diagnostic-summary-empty">
              <Target />
              <div>
                <small>学情画像</small>
                <h2>还没有诊断记录</h2>
                <p>花 2 分钟完成首次诊断，生成优势、薄弱点与推荐起点。</p>
                <div className="diagnostic-summary-actions">
                  <button className="text-button" type="button" onClick={() => navigate("diagnostic")}>去诊断</button>
                </div>
              </div>
            </section>
          )}
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
                  <span>最近 {insight.sampleCount} 次 · 平均 {insight.averageScorePercent}%{mastery ? ` · 累计 ${mastery.attemptCount} 次 / ${mastery.masteryPercent}%${mastery.evidenceCount ? ` · 证据 ${mastery.evidenceCount} 条` : ""}` : ""}</span>
                  {mastery && <div className="progress-track" role="progressbar" aria-label={`${insight.topic}练习掌握参考`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={mastery.masteryPercent}><span style={{ width: `${Math.min(100, Math.max(0, mastery.masteryPercent))}%` }} /></div>}
                  <p>{insight.suggestion}</p>
                  {insightWhy(insight) && <p className="insight-why"><Sparkles size={12} />{insightWhy(insight)}</p>}
                  <button className="button secondary" type="button" onClick={() => onPractice(insight.topic)}><MessageSquareText size={14} />继续练习</button>
                </article>;
              }) : <p>完成 AI 助教小测后，这里会根据近期练习给出建议。</p>}
              <p className="practice-insight-note">仅反映形成性练习，不是正式成绩或能力评定。</p>
            </div>
          </section>
          <section><BarChart3 /><div><small>最近批改</small><h2>{latestGraded ? `${latestGraded.score} 分` : "暂无已批改作业"}</h2><p>{latestGraded?.feedback || "完成并提交作业后，成绩和教师反馈会显示在这里。"}</p></div></section>
          <section className="result-list">
            <FileText />
            <div>
              <small>提交记录</small>
              <h2>最近作业结果</h2>
              {results.slice(0, 5).map((item) => {
                const tone = submissionTone(item.status);
                return (
                  <p className="result-row" key={item.id}>
                    <span>{item.homeworkTitle || "最近一次作业"}</span>
                    <strong className={`task-status-badge tone-${tone}`}>{formatSubmissionStatus(item)}</strong>
                  </p>
                );
              })}
              {!results.length && <p className="inline-empty">暂无作业提交记录。</p>}
            </div>
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

function diagnosticSummary(diagnostic) {
  const strengths = diagnostic.strengths?.length ? `优势：${diagnostic.strengths.join("、")}` : "";
  const weaknesses = diagnostic.weaknesses?.length
    ? `建议加强：${diagnostic.weaknesses.map((item) => item.categoryTitle).join("、")}`
    : "各类别掌握良好";
  return [strengths, weaknesses].filter(Boolean).join("；");
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
