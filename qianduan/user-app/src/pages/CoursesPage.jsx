import { ArrowRight, BookOpen, CheckCircle2, Clock3, LoaderCircle, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { courses as visualCourses } from "../data/learningData.js";
import {
  courseMatchesLearningScope,
  EXPERIENCE,
  experienceForSchoolStage,
  learningProfileLabel,
} from "../experience/experience.js";

const fallbackImageFor = (course, index) => visualCourses.find((item) => item.subject === course.subject)?.image || visualCourses[index % visualCourses.length].image;
const imageFor = (course, index) => course.coverUrl || fallbackImageFor(course, index);

export function CoursesPage({ session, requireLogin, navigate, experience = EXPERIENCE.TEEN, learningProfile }) {
  const [subject, setSubject] = useState("全部");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setCourses([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      coursesApi.list(),
      coursesApi.history(20).catch(() => []),
    ])
      .then(([courseList, historyValue]) => {
        setCourses(Array.isArray(courseList) ? courseList : (courseList?.items || []));
        setHistory(Array.isArray(historyValue) ? historyValue : (historyValue?.items || []));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => setSubject("全部"), [experience, learningProfile?.schoolStage]);

  const stageCourses = useMemo(
    () => courses.filter((course) => courseMatchesLearningScope(
      course.gradeLevel,
      learningProfile?.schoolStage,
      experience,
    )),
    [courses, experience, learningProfile?.schoolStage],
  );
  const subjects = useMemo(
    () => ["全部", ...new Set(stageCourses.map((course) => course.subject).filter(Boolean))],
    [stageCourses],
  );

  const filtered = useMemo(
    () => stageCourses.filter((course) => (
      (subject === "全部" || course.subject === subject)
      && (!query.trim() || course.title.toLowerCase().includes(query.trim().toLowerCase()))
    )),
    [stageCourses, subject, query],
  );
  const scopedHistory = useMemo(() => history.filter((item) => courseMatchesLearningScope(
    item.gradeLevel,
    learningProfile?.schoolStage,
    experience,
  )), [history, experience, learningProfile?.schoolStage]);
  const historyByCourse = useMemo(() => new Map(scopedHistory.map((item) => [String(item.courseId), item])), [scopedHistory]);
  const activeCourse = scopedHistory.find((item) => Number(item.progressPercent || 0) < 100) || scopedHistory[0];
  const completedChapters = scopedHistory.reduce((sum, item) => sum + Number(item.completedChapters || 0), 0);
  const averageProgress = scopedHistory.length
    ? Math.round(scopedHistory.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / scopedHistory.length)
    : 0;
  const profileMatchesExperience = learningProfile?.schoolStage
    && experienceForSchoolStage(learningProfile.schoolStage) === experience;
  const learningScopeLabel = profileMatchesExperience
    ? learningProfileLabel(learningProfile)
    : (experience === EXPERIENCE.PRIMARY ? "小学阶段预览" : "初高中阶段预览");

  function openCourse(course) {
    if (!session) {
      requireLogin();
      return;
    }
    navigate(`courses/${course.id}`);
  }

  return (
    <div className="page inner-page courses-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={experience === EXPERIENCE.PRIMARY ? "探索课程" : "课程中心"}
        title={experience === EXPERIENCE.PRIMARY ? "选一个喜欢的主题开始探险" : "找到适合你的课程"}
        description={experience === EXPERIENCE.PRIMARY
          ? "从故事、图形编程和趣味实验开始，完成每一站的小目标。"
          : "浏览已发布课程，报名后即可查看章节与学习进度。"}
        imageKey="courses"
      />
      <div className="stage-scope-banner" role="status">
        <span><BookOpen size={17} /></span>
        <div><strong>当前课程范围：{learningScopeLabel}</strong><p>课程、进度与推荐已按当前学习阶段筛选，可在个人中心修改学习档案。</p></div>
      </div>
      {session && !loading && (
        <section className="course-overview" aria-label="我的课程概览">
          <div className="course-overview-next">
            <span><BookOpen size={20} /></span>
            <div><small>继续学习</small><strong>{activeCourse?.courseTitle || "选择一门课程开始"}</strong><p>{activeCourse ? `当前进度 ${Number(activeCourse.progressPercent || 0)}%，最近学习 ${formatDate(activeCourse.lastLearningTime)}` : "报名后会在这里保留最近学习位置。"}</p></div>
            <button type="button" onClick={() => activeCourse ? navigate(`courses/${activeCourse.courseId}`) : null} disabled={!activeCourse} title="继续最近课程"><ArrowRight size={18} /></button>
          </div>
          <div className="course-overview-stat"><Clock3 size={18} /><span><strong>{scopedHistory.length}</strong><small>在学课程</small></span></div>
          <div className="course-overview-stat"><CheckCircle2 size={18} /><span><strong>{completedChapters}</strong><small>完成章节</small></span></div>
          <div className="course-overview-stat"><TrendingUp size={18} /><span><strong>{averageProgress}%</strong><small>平均进度</small></span></div>
        </section>
      )}
      <div className="filter-bar">
        <label>
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课程名称" />
        </label>
        <div className="subject-filter">
          <SlidersHorizontal size={17} />
          {subjects.map((item) => (
            <button className={subject === item ? "active" : ""} type="button" key={item} onClick={() => setSubject(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {!session ? (
        <EmptyState title="登录后查看课程" description="课程列表、报名状态和学习进度需要登录后读取。" action="立即登录" onAction={() => requireLogin()} />
      ) : loading ? (
        <LoadingState label="正在加载课程" />
      ) : error ? (
        <EmptyState title="课程加载失败" description={error} action="重新加载" onAction={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="暂无课程" description="当前筛选条件下没有可显示的课程。" />
      ) : (
        <section className="course-grid">
          {filtered.map((course, index) => {
            const progress = historyByCourse.get(String(course.id));
            return <article className="course-detail-card" key={course.id}>
              <img
                src={imageFor(course, index)}
                alt={`${course.title}课程插画`}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackImageFor(course, index);
                }}
              />
              <div className="course-detail-copy">
                <span>{course.subject} · {course.gradeLevel}</span>
                <h2>{course.title}</h2>
                <p>{course.description || "课程暂未填写简介"}</p>
                {progress && <div className="course-card-progress"><div><span style={{ width: `${Math.min(100, Math.max(0, Number(progress.progressPercent || 0)))}%` }} /></div><small>{progress.progressPercent}% · 已完成 {progress.completedChapters}/{progress.totalChapters} 章</small></div>}
                <button className="button secondary" type="button" onClick={() => openCourse(course)}>
                  <BookOpen size={17} />进入课程<ArrowRight size={15} />
                </button>
              </div>
            </article>;
          })}
        </section>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "尚未开始";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}

function LoadingState({ label }) {
  return <div className="loading-state"><LoaderCircle size={22} />{label}</div>;
}

function EmptyState({ title, description, action, onAction }) {
  return (
    <section className="empty-state">
      <BookOpen size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <button className="button primary" type="button" onClick={onAction}>{action}</button>}
    </section>
  );
}
