import { ArrowRight, BookOpen, LoaderCircle, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, practiceApi } from "../api/client.js";
import { courseMatchesLearningScope, EXPERIENCE } from "../experience/experience.js";

// 小学端只认这些知识点：猫咪侦探课、互动绘本和图形编程真正教过的内容。
// 其余练习记录（中学的排序、回归等）不进入学习向导，避免给小学生排中学任务。
const PRIMARY_KNOWLEDGE_CODES = new Set([
  "machine_learning.image_classification",
  "machine_learning.features_labels",
  "computer_vision.object_detection",
  "computing.algorithm_basics",
  "computing.loop_basics",
  "computing.step_by_step_thinking",
]);

export function PrimaryLearningGuide({ session, navigate, onAskTopic, schoolStage, requireLogin }) {
  const [courses, setCourses] = useState([]);
  const [mastery, setMastery] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    let active = true;
    if (!session) {
      setCourses([]);
      setMastery([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    practiceApi.mastery()
      .then(async (masteryItems) => {
        if (!active) return;
        const scopedMastery = (Array.isArray(masteryItems) ? masteryItems : [])
          .filter((item) => PRIMARY_KNOWLEDGE_CODES.has(item.knowledgeCode));
        setMastery(scopedMastery);
        const masteryHints = scopedMastery.map((item) => ({
          knowledgeCode: item.knowledgeCode,
          masteryPercent: Number(item.masteryPercent) || 0,
        }));
        try {
          const recommendations = await coursesApi.personalized(masteryHints, 6);
          const scoped = inPrimaryScope(recommendations, schoolStage);
          if (!scoped.length) throw new Error("no in-scope recommendation");
          if (active) setCourses(scoped);
        } catch {
          const fallback = await coursesApi.recommended(6).catch(() => []);
          if (active) setCourses(inPrimaryScope(fallback, schoolStage).map((course) => ({ course })));
        }
      })
      .catch(() => {
        if (active) setMastery([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [session, schoolStage]);

  const weakPoints = useMemo(
    () => mastery
      .filter((item) => Number(item.masteryPercent) < 70)
      .sort((left, right) => Number(left.masteryPercent) - Number(right.masteryPercent))
      .slice(0, 3),
    [mastery],
  );
  const nextTopic = weakPoints[0]?.topic || null;

  return (
    <aside className="primary-learning-guide" aria-label="我的学习向导">
      <div className="primary-guide-head">
        <span><Sparkles size={17} /></span>
        <div><strong>我的学习向导</strong><small>从最适合你的下一步开始</small></div>
      </div>

      {!session ? (
        <>
          <section className="primary-next-step is-locked">
            <small>下一步学什么</small>
            <strong>从互动绘本认识图像分类</strong>
            <p>登录后，小智会按你的学段安排最合适的下一步。</p>
            <button className="button primary compact" type="button" onClick={() => requireLogin?.()}>
              登录解锁<ArrowRight size={14} />
            </button>
          </section>
          <section className="primary-guide-section">
            <header><Target size={15} /><strong>需要再练一练</strong></header>
            <p>完成小测后，需要巩固的知识点会在这里排好队。</p>
          </section>
          <section className="primary-guide-section">
            <header><BookOpen size={15} /><strong>为你推荐的课程</strong></header>
            <p>按学段挑选的猫咪侦探课和绘本课会出现在这里。</p>
          </section>
          <button className="primary-picture-book-link" type="button" onClick={() => navigate("picture-books")}>
            <BookOpen size={17} /><span><strong>互动绘本专题</strong><small>先去听一个故事</small></span><ArrowRight size={15} />
          </button>
        </>
      ) : loading ? (
        <div className="primary-guide-loading"><LoaderCircle className="spin" size={17} />正在准备学习建议</div>
      ) : (
        <>
          <section className="primary-next-step">
            <small>下一步学什么</small>
            <strong>{nextTopic || "从互动绘本认识图像分类"}</strong>
            <p>{nextTopic ? "和小智一起复习它，再做一道小练习。" : "先听故事，再完成一个小挑战。"}</p>
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

function inPrimaryScope(recommendations, schoolStage) {
  return (Array.isArray(recommendations) ? recommendations : []).filter((item) => {
    const course = item?.course || item;
    return courseMatchesLearningScope(course?.gradeLevel, schoolStage, EXPERIENCE.PRIMARY);
  });
}
