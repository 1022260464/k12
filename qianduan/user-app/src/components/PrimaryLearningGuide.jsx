import { ArrowRight, BookOpen, LoaderCircle, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, practiceApi } from "../api/client.js";

export function PrimaryLearningGuide({ session, navigate, onAskTopic }) {
  const [courses, setCourses] = useState([]);
  const [insights, setInsights] = useState([]);
  const [mastery, setMastery] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    let active = true;
    if (!session) {
      setCourses([]);
      setInsights([]);
      setMastery([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    Promise.allSettled([
      practiceApi.insights(),
      practiceApi.mastery(),
    ]).then(async ([insightResult, masteryResult]) => {
      if (!active) return;
      const masteryItems = masteryResult.status === "fulfilled" && Array.isArray(masteryResult.value)
        ? masteryResult.value
        : [];
      setInsights(insightResult.status === "fulfilled" && Array.isArray(insightResult.value)
        ? insightResult.value
        : []);
      setMastery(masteryItems);
      try {
        const recommendations = await coursesApi.personalized(
          masteryItems.map((item) => ({
            knowledgeCode: item.knowledgeCode,
            masteryPercent: Number(item.masteryPercent) || 0,
          })),
          4,
        );
        if (active) setCourses(Array.isArray(recommendations) ? recommendations : []);
      } catch {
        const fallback = await coursesApi.recommended(4).catch(() => []);
        if (active) setCourses((Array.isArray(fallback) ? fallback : []).map((course) => ({ course })));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [session]);

  const weakPoints = useMemo(
    () => mastery
      .filter((item) => Number(item.masteryPercent) < 70)
      .sort((left, right) => Number(left.masteryPercent) - Number(right.masteryPercent))
      .slice(0, 3),
    [mastery],
  );
  const nextTopic = weakPoints[0]?.topic || insights[0]?.topic || null;

  return (
    <aside className="primary-learning-guide" aria-label="我的学习向导">
      <div className="primary-guide-head">
        <span><Sparkles size={17} /></span>
        <div><strong>我的学习向导</strong><small>从最适合你的下一步开始</small></div>
      </div>

      {!session ? (
        <p className="primary-guide-empty">登录后，小智会根据课程和练习记录安排下一步。</p>
      ) : loading ? (
        <div className="primary-guide-loading"><LoaderCircle className="spin" size={17} />正在准备学习建议</div>
      ) : (
        <>
          <section className="primary-next-step">
            <small>下一步学什么</small>
            <strong>{nextTopic || "从互动绘本认识图像分类"}</strong>
            <p>{insights[0]?.suggestion || "先看故事，再完成一个小挑战。"}</p>
            <button
              className="button primary compact"
              type="button"
              onClick={() => (nextTopic ? onAskTopic(nextTopic) : navigate("picture-books"))}
            >
              开始学习<ArrowRight size={14} />
            </button>
          </section>

          <section className="primary-guide-section">
            <header><Target size={15} /><strong>需要再练一练</strong></header>
            {weakPoints.length ? (
              <div className="primary-weak-list">
                {weakPoints.map((item) => (
                  <button type="button" key={item.knowledgeCode || item.topic} onClick={() => onAskTopic(item.topic)}>
                    <span>{item.topic || "相关知识点"}</span><small>{Number(item.masteryPercent) || 0}%</small>
                  </button>
                ))}
              </div>
            ) : <p>完成小测后，小智会把需要巩固的内容放在这里。</p>}
          </section>

          <section className="primary-guide-section">
            <header><BookOpen size={15} /><strong>为你推荐的课程</strong></header>
            {courses.length ? (
              <div className="primary-course-list">
                {courses.slice(0, 3).map((item) => {
                  const course = item.course || item;
                  return (
                    <button type="button" key={course.id} onClick={() => navigate(`courses/${course.id}${item.chapterId ? `/chapters/${item.chapterId}` : ""}`)}>
                      <strong>{course.title}</strong>
                      <small>{item.reason || [course.subject, course.gradeLevel].filter(Boolean).join(" · ") || "人工智能通识"}</small>
                    </button>
                  );
                })}
              </div>
            ) : <button className="text-button" type="button" onClick={() => navigate("courses")}>去探索课程<ArrowRight size={13} /></button>}
          </section>

          <button className="primary-picture-book-link" type="button" onClick={() => navigate("picture-books") }>
            <BookOpen size={17} /><span><strong>互动绘本专题</strong><small>听故事、看图片、做挑战</small></span><ArrowRight size={15} />
          </button>
        </>
      )}
    </aside>
  );
}
