import { ArrowRight, BookOpen, LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi } from "../api/client.js";
import { courses as visualCourses } from "../data/learningData.js";

const subjects = ["全部", "信息科技", "数学", "科学", "英语", "拓展课程"];
const imageFor = (course, index) => visualCourses.find((item) => item.subject === course.subject)?.image || visualCourses[index % visualCourses.length].image;

export function CoursesPage({ session, requireLogin }) {
  const [subject, setSubject] = useState("全部");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!session) { setCourses([]); setLoading(false); return; }
    setLoading(true);
    coursesApi.list().then(setCourses).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [session]);

  const filtered = useMemo(() => courses.filter((course) => (subject === "全部" || course.subject === subject) && (!query.trim() || course.title.toLowerCase().includes(query.trim().toLowerCase()))), [courses, subject, query]);

  async function openCourse(course) {
    if (!session) { requireLogin(); return; }
    setSelected(course);
    setDetail(null);
    setDetailLoading(true);
    const [chapters, enrollment, progress] = await Promise.all([
      coursesApi.chapters(course.id).catch(() => []),
      coursesApi.enrollment(course.id).catch(() => null),
      coursesApi.progress(course.id).catch(() => null),
    ]);
    setDetail({ chapters, enrollment, progress });
    setDetailLoading(false);
  }

  async function toggleEnrollment() {
    const enrolled = detail?.enrollment?.status === "ENROLLED";
    try {
      const enrollment = enrolled ? await coursesApi.withdraw(selected.id) : await coursesApi.enroll(selected.id);
      setDetail((current) => ({ ...current, enrollment: enrolled ? null : enrollment }));
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <div className="page inner-page">
      <header className="page-title"><p className="eyebrow">课程中心</p><h1>找到适合你的课程</h1><p>课程、章节、报名状态和学习进度均来自 Learning Service。</p></header>
      <div className="filter-bar"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课程名称" /></label><div className="subject-filter"><SlidersHorizontal size={17} />{subjects.map((item) => <button className={subject === item ? "active" : ""} type="button" key={item} onClick={() => setSubject(item)}>{item}</button>)}</div></div>
      {!session ? <EmptyState title="登录后查看课程" description="课程列表、报名状态和学习进度需要登录后读取。" action="立即登录" onAction={() => requireLogin()} /> : loading ? <LoadingState label="正在加载课程" /> : error ? <EmptyState title="课程加载失败" description={error} action="重新加载" onAction={() => window.location.reload()} /> : filtered.length === 0 ? <EmptyState title="暂无课程" description="当前筛选条件下没有可显示的课程。" /> : <section className="course-grid">{filtered.map((course, index) => <article className="course-detail-card" key={course.id}><img src={imageFor(course, index)} alt={`${course.title}课程插画`} /><div className="course-detail-copy"><span>{course.subject} · {course.gradeLevel}</span><h2>{course.title}</h2><p>{course.description || "课程暂未填写简介"}</p><button className="button secondary" type="button" onClick={() => openCourse(course)}><BookOpen size={17} />查看课程<ArrowRight size={15} /></button></div></article>)}</section>}

      {selected && <div className="drawer-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="课程详情" onMouseDown={(event) => event.stopPropagation()}><header><div><small>{selected.subject} · {selected.gradeLevel}</small><h2>{selected.title}</h2></div><button className="icon-button" type="button" title="关闭" onClick={() => setSelected(null)}><X size={18} /></button></header>{detailLoading ? <LoadingState label="正在读取课程详情" /> : <><p className="drawer-description">{selected.description || "课程暂未填写简介。"}</p><div className="course-status-row"><div><strong>{detail?.progress?.progressPercent ?? 0}%</strong><span>课程进度</span></div><button className="button primary" type="button" onClick={toggleEnrollment}>{detail?.enrollment?.status === "ENROLLED" ? "退出课程" : "报名课程"}</button></div><h3>章节目录</h3><div className="chapter-list">{detail?.chapters?.length ? detail.chapters.map((chapter, index) => <button type="button" key={chapter.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{chapter.title}</strong><small>点击进入章节学习</small></div><ArrowRight size={16} /></button>) : <p className="inline-empty">该课程尚未发布章节。</p>}</div></>}</aside></div>}
    </div>
  );
}

function LoadingState({ label }) { return <div className="loading-state"><LoaderCircle size={22} />{label}</div>; }
function EmptyState({ title, description, action, onAction }) { return <section className="empty-state"><BookOpen size={28} /><h2>{title}</h2><p>{description}</p>{action && <button className="button primary" type="button" onClick={onAction}>{action}</button>}</section>; }
