import { Activity, Clock3, GraduationCap, Lightbulb, RefreshCw, Search, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { learningEvidenceApi, usersApi } from "../api/client.js";

const formatDate = (value) => value ? new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "-";
const percent = (value) => `${Math.max(0, Math.min(100, value || 0))}%`;

export function StudentLearningEvidencePage({ notify }) {
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStudents() {
    setLoading(true); setError("");
    try {
      const result = await usersApi.students();
      setStudents(Array.isArray(result) ? result : []);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadStudents(); }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter((student) => [student.nickname, student.username, student.email, student.grade]
      .some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [students, query]);

  const selected = students.find((student) => String(student.id) === String(selectedId));

  async function loadEvidence(studentId = selectedId) {
    if (!studentId) return;
    setEvidenceLoading(true); setError("");
    try { setEvidence(await learningEvidenceApi.get(studentId, 30)); }
    catch (cause) { setError(cause.message); setEvidence(null); notify?.(cause.message, "error"); }
    finally { setEvidenceLoading(false); }
  }

  async function selectStudent(student) {
    setSelectedId(String(student.id));
    await loadEvidence(student.id);
  }

  const mastery = evidence?.mastery || [];
  const attempts = evidence?.recentAttempts || [];
  const average = mastery.length ? Math.round(mastery.reduce((sum, item) => sum + item.masteryPercent, 0) / mastery.length) : 0;
  const hints = attempts.reduce((sum, item) => sum + (item.hintCount || 0), 0);

  return (
    <section className="page-section evidence-page">
      <header className="page-heading"><div><p className="eyebrow">FORMATIVE LEARNING EVIDENCE</p><h1>学生学习证据</h1><p>查看练习过程、知识点掌握度和薄弱项，用于教学调整，不替代正式作业成绩。</p></div>{selectedId && <button className="button" type="button" onClick={() => loadEvidence()}><RefreshCw size={16} />刷新证据</button>}</header>
      <div className="evidence-layout">
        <aside className="evidence-students">
          <label className="search-control"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学生" /></label>
          <div className="evidence-student-list">
            {loading ? <p className="admin-empty">正在加载学生…</p> : filtered.length === 0 ? <p className="admin-empty">没有可查看的学生</p> : filtered.map((student) => <button className={String(student.id) === String(selectedId) ? "active" : ""} type="button" key={student.id} onClick={() => selectStudent(student)}><span>{(student.nickname || student.username || "学").slice(0, 1)}</span><div><strong>{student.nickname || student.username}</strong><small>{student.grade || student.username}</small></div></button>)}
          </div>
        </aside>
        <div className="evidence-content">
          {!selectedId ? <div className="evidence-placeholder"><GraduationCap size={34} /><h2>选择一名学生</h2><p>教师仅能查看自己授课或作业覆盖学生的过程证据。</p></div>
            : evidenceLoading ? <div className="evidence-placeholder"><Activity className="spin" /><p>正在汇总 {selected?.nickname || selected?.username} 的学习记录…</p></div>
              : error ? <div className="evidence-placeholder table-error"><p>{error}</p><button className="button" type="button" onClick={() => loadEvidence()}>重试</button></div>
                : <>
                  <div className="evidence-summary">
                    <article><Target /><div><strong>{average}%</strong><small>平均掌握度</small></div></article>
                    <article><Activity /><div><strong>{attempts.length}</strong><small>近期练习</small></div></article>
                    <article><Lightbulb /><div><strong>{hints}</strong><small>使用提示</small></div></article>
                    <article><Clock3 /><div><strong>{Math.round(attempts.reduce((sum, item) => sum + (item.durationMs || 0), 0) / 1000)}s</strong><small>累计练习时长</small></div></article>
                  </div>
                  <section className="evidence-panel"><header><div><h2>知识点掌握</h2><p>按形成性练习累计计算，建议结合课堂观察判断。</p></div></header>
                    {mastery.length === 0 ? <p className="admin-empty">暂无知识点练习记录</p> : <div className="mastery-list">{mastery.map((item) => <article key={item.knowledgeCode}><div><strong>{item.topic || item.knowledgeCode}</strong><small>{item.knowledgeCode} · 练习 {item.attemptCount} 次</small></div><div className="mastery-meter"><span style={{ width: percent(item.masteryPercent) }} /></div><b>{item.masteryPercent}%</b><p>{item.action}</p></article>)}</div>}
                  </section>
                  <section className="evidence-panel"><header><div><h2>近期过程记录</h2><p>{evidence?.evidenceNotice}</p></div></header>
                    <div className="table-wrap"><table className="responsive-table"><thead><tr><th>时间 / 主题</th><th>得分</th><th>提示</th><th>耗时</th><th>薄弱点 / 错误类型</th></tr></thead><tbody>{attempts.length === 0 ? <tr><td colSpan="5" className="empty-cell">暂无形成性练习证据</td></tr> : attempts.map((item) => <tr key={item.id}><td data-label="时间 / 主题"><strong>{item.topic || item.knowledgeCode}</strong><small>{formatDate(item.createdTime)}</small></td><td data-label="得分">{item.score}/{item.maxScore}</td><td data-label="提示">{item.hintCount || 0}</td><td data-label="耗时">{Math.round((item.durationMs || 0) / 1000)} 秒</td><td data-label="薄弱点 / 错误类型"><strong>{item.weakPoint || "未发现明显薄弱点"}</strong>{item.errorTypes?.length ? <small>{item.errorTypes.join("、")}</small> : null}</td></tr>)}</tbody></table></div>
                  </section>
                </>}
        </div>
      </div>
    </section>
  );
}
