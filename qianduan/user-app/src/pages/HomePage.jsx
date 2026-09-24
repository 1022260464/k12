import { ArrowRight, ChevronLeft, ChevronRight, LoaderCircle, Play, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { coursesApi } from "../api/client.js";
import { DailyLearningPlan } from "../components/DailyLearningPlan.jsx";
import { LearningRhythm } from "../components/LearningRhythm.jsx";
import { courses as fallbackCourses } from "../data/learningData.js";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

const fallbackImageFor = (course, index) => fallbackCourses.find((item) => item.subject === course.subject)?.image
  || fallbackCourses[index % fallbackCourses.length].image;

export function HomePage({ session, displayName, navigate, requireLogin, onAskTopic, experience = EXPERIENCE.TEEN }) {
  const railRef = useRef(null);
  const [recommended, setRecommended] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const scrollCourses = (direction) => railRef.current?.scrollBy({ left: direction * 380, behavior: "smooth" });

  useEffect(() => {
    if (!session) {
      setRecommended([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    coursesApi.recommended(8)
      .then((list) => {
        if (!active) return;
        setRecommended(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (active) setRecommended([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [session]);

  const showcase = recommended.length
    ? recommended.map((course, index) => ({
      id: course.id,
      title: course.title,
      subject: course.subject,
      grade: course.gradeLevel,
      next: course.description?.trim()?.slice(0, 28) || "打开课程查看章节",
      image: course.coverUrl || fallbackImageFor(course, index),
    }))
    : fallbackCourses;
  const primary = experience === EXPERIENCE.PRIMARY;
  const visuals = visualsFor(experience);
  const hero = primary
    ? {
      eyebrow: "小学 AI 探索乐园",
      title: session ? `${displayName}，今天想探索什么？` : "和小智一起，发现 AI 的奇妙世界",
      description: "通过故事、图形编程和趣味挑战认识人工智能，每完成一步都能看见自己的成长。",
      action: "开始今天的探索",
    }
    : {
      eyebrow: "个性化学习空间",
      title: session ? `${displayName}，继续今天的学习` : "让每一次学习，都有清晰的下一步",
      description: "课程、练习与 AI 学习台集中在一个学习空间，根据进度提供适合你的内容。",
      action: "打开 AI 学习台",
    };

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> {hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p>{hero.description}</p>
          <div className="hero-actions"><button className="button primary" type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><Play size={17} />{hero.action}</button><button className="text-button" type="button" onClick={() => navigate("courses")}>{primary ? "看看探索课程" : "浏览全部课程"}<ArrowRight size={16} /></button></div>
        </div>
        <div className="hero-image experience-hero-art" aria-label={primary ? "小学生和小智一起探索人工智能" : "初高中学生协作学习人工智能"}>
          <img className="hero-student-art" src={visuals.heroStudent} alt="" fetchPriority="high" />
          <img className="hero-mascot-art" src={visuals.mascot} alt="" fetchPriority="high" />
          <img className="hero-accent-art hero-accent-one" src={visuals.encouragement} alt="" aria-hidden="true" />
          <img className="hero-accent-art hero-accent-two" src={visuals.science} alt="" aria-hidden="true" />
          <span>{primary ? "小智陪你边玩边学" : "从理解到实践，步步有反馈"}</span>
        </div>
      </section>

      {primary && (
        <section className="primary-adventure-strip" aria-label="小学端学习入口">
          <button className="primary-featured-lesson" type="button" onClick={() => navigate("picture-books")}>
            <img src={visuals.reading} alt="" /><div><small>绘本专题</small><strong>走进小智互动绘本馆</strong><p>听故事、看图片，再完成一个趣味挑战。</p></div><ArrowRight size={18} />
          </button>
          <button type="button" onClick={() => navigate("visual-code-lab")}>
            <img src={visuals.code} alt="" /><div><small>动手创造</small><strong>图形化编程闯关</strong><p>拖动积木，让角色完成任务。</p></div><ArrowRight size={18} />
          </button>
          <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}>
            <img src={visuals.reading} alt="" /><div><small>故事学习</small><strong>听小智讲 AI 故事</strong><p>用熟悉的生活例子认识 AI。</p></div><ArrowRight size={18} />
          </button>
          <button type="button" onClick={() => navigate("tasks")}>
            <img src={visuals.tasks} alt="" /><div><small>趣味挑战</small><strong>完成今天的小任务</strong><p>答题、练习，收集成长记录。</p></div><ArrowRight size={18} />
          </button>
        </section>
      )}

      <DailyLearningPlan session={session} navigate={navigate} onAskTopic={onAskTopic} experience={experience} />

      {session && <LearningRhythm session={session} navigate={navigate} experience={experience} className="home-learning-rhythm" />}

      <section className="home-section course-showcase">
        <header className="section-heading"><div><p className="eyebrow">{primary ? "为你准备" : "推荐课程"}</p><h2>{primary ? "选择一场新的探索" : "从感兴趣的课程开始"}</h2><p>{session ? (primary ? "从故事、实验和图形化编程中认识人工智能。" : "覆盖学科基础、科学探究和编程创造。") : "登录后可查看平台已发布课程推荐。"}</p></div><div className="carousel-actions"><button className="icon-button" type="button" title="上一组课程" onClick={() => scrollCourses(-1)}><ChevronLeft size={18} /></button><button className="icon-button" type="button" title="下一组课程" onClick={() => scrollCourses(1)}><ChevronRight size={18} /></button></div></header>
        {session && loading ? (
          <div className="empty-state" style={{ minHeight: 180 }}><LoaderCircle className="spin" size={22} /><p>正在加载推荐课程</p></div>
        ) : (
          <div className="visual-course-rail" ref={railRef}>{showcase.map((course) => (
            <article className="visual-course-card" key={course.id || course.title}>
              <img src={course.image} alt={`${course.title}课程插画`} loading="lazy" />
              <div>
                <span>{course.subject} · {course.grade}</span>
                <h3>{course.title}</h3>
                <p>下一节：{course.next}</p>
                <button type="button" onClick={() => (course.id ? requireLogin(() => navigate(`courses/${course.id}`)) : requireLogin())}>
                  进入课程<ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}</div>
        )}
      </section>

      <section className="home-section home-shortcuts">
        <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><img src={visuals.ai} alt="" /><div><strong>{primary ? "问问小智" : "AI 学习台"}</strong><p>{primary ? "有问题随时问，也可以听故事" : "主题讲解、动画步骤与课堂小测"}</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("courses")}><img src={visuals.courses} alt="" /><div><strong>{primary ? "继续探索" : "继续课程"}</strong><p>{primary ? "回到上次学习的有趣知识" : "从上次离开的知识点继续学习"}</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("tasks")}><img src={visuals.tasks} alt="" /><div><strong>{primary ? "今日挑战" : "今日作业"}</strong><p>{primary ? "完成老师布置的小任务" : "查看截止时间和待完成练习"}</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("progress")}><img src={visuals.progress} alt="" /><div><strong>{primary ? "成长记录" : "学习报告"}</strong><p>{primary ? "看看新进步和获得的成绩" : "了解本周进度和薄弱知识点"}</p></div><ArrowRight size={18} /></button>
      </section>
    </div>
  );
}
