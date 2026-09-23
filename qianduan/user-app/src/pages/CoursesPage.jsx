import { ArrowRight, BookOpen, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { courses as visualCourses } from "../data/learningData.js";
import { EXPERIENCE } from "../experience/experience.js";

const subjects = ["全部", "信息科技", "数学", "科学", "英语", "拓展课程"];
const fallbackImageFor = (course, index) => visualCourses.find((item) => item.subject === course.subject)?.image || visualCourses[index % visualCourses.length].image;
const imageFor = (course, index) => course.coverUrl || fallbackImageFor(course, index);

export function CoursesPage({ session, requireLogin, navigate, experience = EXPERIENCE.TEEN }) {
  const [subject, setSubject] = useState("全部");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    coursesApi.list()
      .then(setCourses)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [session]);

  const filtered = useMemo(
    () => courses.filter((course) => (
      (subject === "全部" || course.subject === subject)
      && (!query.trim() || course.title.toLowerCase().includes(query.trim().toLowerCase()))
    )),
    [courses, subject, query],
  );

  function openCourse(course) {
    if (!session) {
      requireLogin();
      return;
    }
    navigate(`courses/${course.id}`);
  }

  return (
    <div className="page inner-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={experience === EXPERIENCE.PRIMARY ? "探索课程" : "课程中心"}
        title={experience === EXPERIENCE.PRIMARY ? "选一个喜欢的主题开始探险" : "找到适合你的课程"}
        description={experience === EXPERIENCE.PRIMARY
          ? "从故事、图形编程和趣味实验开始，完成每一站的小目标。"
          : "浏览已发布课程，报名后即可查看章节与学习进度。"}
        imageKey="courses"
      />
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
          {filtered.map((course, index) => (
            <article className="course-detail-card" key={course.id}>
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
                <button className="button secondary" type="button" onClick={() => openCourse(course)}>
                  <BookOpen size={17} />进入课程<ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
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
