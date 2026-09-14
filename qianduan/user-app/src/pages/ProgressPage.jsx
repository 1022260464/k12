import { BarChart3, BookOpen, CheckCircle2, LoaderCircle, Pencil, Save, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { homeworksApi, profileApi } from "../api/client.js";

const stages = [["PRIMARY_LOWER", "小学低年级"], ["PRIMARY_UPPER", "小学高年级"], ["JUNIOR_HIGH", "初中"], ["SENIOR_HIGH", "高中"]];

export function ProgressPage({ session, requireLogin }) {
  const [profile, setProfile] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ schoolStage: "JUNIOR_HIGH", grade: 7, textbook: "", interests: "" });

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    Promise.all([profileApi.getLearningProfile().catch(() => null), homeworksApi.learningResults().catch(() => ({ items: [] }))])
      .then(([profileData, resultData]) => {
        setProfile(profileData);
        setResults(resultData?.items || []);
        if (profileData) setForm({ ...profileData, interests: (profileData.interests || []).join("、") });
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [session]);

  const metrics = useMemo(() => {
    const graded = results.filter((item) => item.status === "GRADED");
    const average = graded.length ? Math.round(graded.reduce((sum, item) => sum + Number(item.score || 0), 0) / graded.length) : 0;
    return { completed: results.length, graded: graded.length, average };
  }, [results]);

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
      <header className="page-title page-title-row"><div><p className="eyebrow">学习报告</p><h1>看见每一步进步</h1><p>学习档案和作业结果均来自真实业务接口。</p></div><button className="button secondary" type="button" onClick={() => setEditing((value) => !value)}><Pencil size={16} />{editing ? "取消编辑" : "编辑学习档案"}</button></header>
      {error && <p className="page-error">{error}</p>}
      {editing && <form className="profile-form" onSubmit={saveProfile}><label>学段<select value={form.schoolStage} onChange={(event) => setForm({ ...form, schoolStage: event.target.value })}>{stages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>年级<input type="number" min="1" max="12" value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} required /></label><label>教材<input value={form.textbook} onChange={(event) => setForm({ ...form, textbook: event.target.value })} placeholder="例如：人教版" /></label><label>兴趣<input value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} placeholder="使用顿号分隔" /></label><button className="button primary" type="submit"><Save size={16} />保存档案</button></form>}
      <section className="report-stats"><article><span><BookOpen /></span><div><strong>{metrics.completed} 项</strong><small>学习结果</small></div></article><article><span><CheckCircle2 /></span><div><strong>{metrics.graded} 项</strong><small>已批改</small></div></article><article><span><TrendingUp /></span><div><strong>{metrics.average} 分</strong><small>平均成绩</small></div></article></section>
      <div className="report-layout"><section className="report-panel"><header><div><h2>学习档案</h2><p>用于课程推荐与 AI 个性化上下文</p></div><strong>{profile?.grade ? `${profile.grade} 年级` : "未完善"}</strong></header><img src="/assets/course-reading-comic.png" alt="AI 助教陪伴学生阅读学习" /><dl className="profile-summary"><div><dt>学段</dt><dd>{stages.find(([value]) => value === profile?.schoolStage)?.[1] || "未设置"}</dd></div><div><dt>教材</dt><dd>{profile?.textbook || "未设置"}</dd></div><div><dt>兴趣</dt><dd>{profile?.interests?.join("、") || "未设置"}</dd></div></dl></section><aside className="report-side"><section><BarChart3 /><div><small>最近结果</small><h2>{results[0]?.score != null ? `${results[0].score} 分` : "暂无已批改作业"}</h2><p>{results[0]?.feedback || "完成并提交作业后，成绩和教师反馈会显示在这里。"}</p></div></section><section className="result-list"><div><small>提交记录</small><h2>最近学习活动</h2></div>{results.slice(0, 5).map((item) => <p key={item.id}><span>作业 #{item.homeworkId}</span><strong>{item.status === "GRADED" ? `${item.score} 分` : item.status}</strong></p>)}{!results.length && <p className="inline-empty">暂无学习结果。</p>}</section></aside></div>
    </div>
  );
}
