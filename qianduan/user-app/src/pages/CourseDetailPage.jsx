import { ArrowLeft, ArrowRight, BookOpen, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi } from "../api/client.js";
import { courses as visualCourses } from "../data/learningData.js";
import { CourseAttachmentList } from "../components/CourseAttachmentList.jsx";
import { CourseReader } from "../components/CourseReader.jsx";

const fallbackImageFor = (course, index = 0) =>
  visualCourses.find((item) => item.subject === course?.subject)?.image
  || visualCourses[index % visualCourses.length].image;

export function CourseDetailPage({ session, requireLogin, navigate, courseId, chapterId }) {
  const [course, setCourse] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeChapter, setActiveChapter] = useState(null);

  useEffect(() => {
    if (!session) {
      setCourse(null);
      setDetail(null);
      setActiveChapter(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError("");
    setActiveChapter(null);
    (async () => {
      try {
        const courseData = await coursesApi.get(courseId);
        if (!alive) return;
        setCourse(courseData);
        const enrollment = await coursesApi.enrollment(courseId).catch((requestError) => {
          // 兼容旧后端：未选课可能仍返回 404
          if (requestError.status === 404) return null;
          throw requestError;
        });
        const enrolled = Boolean(enrollment) && enrollment.status === "ACTIVE";
        const [chapters, progress] = enrolled
          ? await Promise.all([coursesApi.chapters(courseId), coursesApi.progress(courseId)])
          : [[], null];
        if (!alive) return;
        setDetail({ chapters, enrollment, progress });
        if (chapterId && enrolled) {
          const chapter = chapters.find((item) => String(item.id) === String(chapterId));
          setActiveChapter(chapter || null);
          if (!chapter) setError("未找到该章节，或你尚未报名本课程。");
        }
      } catch (requestError) {
        if (alive) {
          setCourse(null);
          setDetail(null);
          setError(requestError.message);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, courseId, chapterId]);

  const cover = useMemo(
    () => (course ? (course.coverUrl || fallbackImageFor(course)) : null),
    [course],
  );

  async function toggleEnrollment() {
    if (!course || !detail) return;
    const enrolled = detail.enrollment?.status === "ACTIVE";
    try {
      const enrollment = enrolled
        ? await coursesApi.withdraw(course.id)
        : await coursesApi.enroll(course.id);
      const [chapters, progress] = enrolled
        ? [[], null]
        : await Promise.all([coursesApi.chapters(course.id), coursesApi.progress(course.id)]);
      setDetail({ chapters, enrollment: enrolled ? null : enrollment, progress });
      setActiveChapter(null);
      setError("");
      if (chapterId) navigate(`courses/${course.id}`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshProgress() {
    const progress = await coursesApi.progress(courseId);
    setDetail((current) => (current ? { ...current, progress } : current));
  }

  function openChapter(chapter) {
    navigate(`courses/${courseId}/chapters/${chapter.id}`);
  }

  if (!session) {
    return (
      <div className="page inner-page detail-page">
        <button className="text-button detail-back" type="button" onClick={() => navigate("courses")}>
          <ArrowLeft size={16} />返回课程中心
        </button>
        <section className="empty-state">
          <BookOpen size={28} />
          <h2>登录后查看课程</h2>
          <p>课程详情、章节内容和学习进度需要登录后读取。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page inner-page detail-page">
        <button className="text-button detail-back" type="button" onClick={() => navigate("courses")}>
          <ArrowLeft size={16} />返回课程中心
        </button>
        <div className="loading-state"><LoaderCircle size={22} />正在加载课程</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page inner-page detail-page">
        <button className="text-button detail-back" type="button" onClick={() => navigate("courses")}>
          <ArrowLeft size={16} />返回课程中心
        </button>
        <section className="empty-state">
          <BookOpen size={28} />
          <h2>课程不存在或暂时无法打开</h2>
          <p>{error || "请返回课程中心重试。"}</p>
          <button className="button primary" type="button" onClick={() => navigate("courses")}>返回课程中心</button>
        </section>
      </div>
    );
  }

  const enrolled = detail?.enrollment?.status === "ACTIVE";
  const reading = Boolean(activeChapter && enrolled);

  return (
    <div className={`page inner-page detail-page${reading ? " detail-page-reading" : ""}`}>
      <button
        className="text-button detail-back"
        type="button"
        onClick={() => (reading ? navigate(`courses/${courseId}`) : navigate("courses"))}
      >
        <ArrowLeft size={16} />
        {reading ? "返回课程目录" : "返回课程中心"}
      </button>

      {reading ? (
        <section className="course-workspace course-workspace-reader">
          <CourseReader
            courseId={course.id}
            chapters={detail?.chapters || []}
            chapter={activeChapter}
            progressByChapter={Object.fromEntries(
              (detail?.progress?.chapters || []).map((item) => [item.chapterId, item.progressPercent]),
            )}
            onBack={() => navigate(`courses/${courseId}`)}
            onCompleted={refreshProgress}
            onSelectChapter={(next) => {
              if (next && String(next.id) !== String(activeChapter?.id)) {
                navigate(`courses/${courseId}/chapters/${next.id}`);
              }
            }}
          />
        </section>
      ) : (
        <section className="detail-workspace course-workspace">
          <header className="detail-hero">
            {cover && (
              <img
                className="detail-hero-cover"
                src={cover}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackImageFor(course);
                }}
              />
            )}
            <div className="detail-hero-copy">
              <p className="eyebrow">{course.subject} · {course.gradeLevel}</p>
              <h1>{course.title}</h1>
              <p>{course.description || "课程暂未填写简介。"}</p>
              <div className="course-status-row">
                <div>
                  <strong>{detail?.progress?.progressPercent ?? 0}%</strong>
                  <span>课程进度</span>
                </div>
                <button className="button primary" type="button" onClick={toggleEnrollment}>
                  {enrolled ? "退出课程" : "报名课程"}
                </button>
              </div>
            </div>
          </header>

          {error && <p className="page-error" role="alert">{error}</p>}

          {enrolled && <CourseAttachmentList courseId={course.id} />}

          <div className="detail-section">
            <h2>章节目录</h2>
            <div className="chapter-list chapter-list-wide">
              {!enrolled ? (
                <p className="inline-empty">报名后可查看章节和小节内容。</p>
              ) : detail?.chapters?.length ? (
                detail.chapters.map((chapter, index) => (
                  <button type="button" key={chapter.id} onClick={() => openChapter(chapter)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{chapter.title}</strong>
                      <small>
                        {detail.progress?.chapters?.find((item) => item.chapterId === chapter.id)?.progressPercent === 100
                          ? "已完成"
                          : "进入章节学习"}
                      </small>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                ))
              ) : (
                <p className="inline-empty">该课程尚未添加章节。</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
