import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Play, Sparkles, Target } from "lucide-react";
import { useRef } from "react";
import { courses } from "../data/learningData.js";

export function HomePage({ session, displayName, navigate, requireLogin }) {
  const railRef = useRef(null);
  const scrollCourses = (direction) => railRef.current?.scrollBy({ left: direction * 380, behavior: "smooth" });

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> 个性化学习空间</p>
          <h1>{session ? `${displayName}，继续今天的学习` : "让每一次学习，都有清晰的下一步"}</h1>
          <p>课程、练习与 AI 学习台集中在一个学习空间，根据进度提供适合你的内容。</p>
          <div className="hero-actions"><button className="button primary" type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><Play size={17} />打开 AI 学习台</button><button className="text-button" type="button" onClick={() => navigate("courses")}>浏览全部课程<ArrowRight size={16} /></button></div>
        </div>
        <div className="hero-image"><img src="/assets/k12-ai-learning-journey.png" alt="学生沿着个性化学习路径前往智能课堂" /></div>
      </section>

      <section className="home-section course-showcase">
        <header className="section-heading"><div><p className="eyebrow">推荐课程</p><h2>从感兴趣的课程开始</h2><p>覆盖学科基础、科学探究和编程创造。</p></div><div className="carousel-actions"><button className="icon-button" type="button" title="上一组课程" onClick={() => scrollCourses(-1)}><ChevronLeft size={18} /></button><button className="icon-button" type="button" title="下一组课程" onClick={() => scrollCourses(1)}><ChevronRight size={18} /></button></div></header>
        <div className="visual-course-rail" ref={railRef}>{courses.map((course) => <article className="visual-course-card" key={course.title}><img src={course.image} alt={`${course.title}课程插画`} /><div><span>{course.subject} · {course.grade}</span><h3>{course.title}</h3><p>下一节：{course.next}</p><button type="button" onClick={() => requireLogin()}>进入课程<ArrowRight size={15} /></button></div></article>)}</div>
      </section>

      <section className="home-section home-shortcuts">
        <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><span><Sparkles size={20} /></span><div><strong>AI 学习台</strong><p>主题讲解、动画步骤与课堂小测</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("courses")}><span><Play size={20} /></span><div><strong>继续课程</strong><p>从上次离开的知识点继续学习</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("tasks")}><span><Clock3 size={20} /></span><div><strong>今日作业</strong><p>查看截止时间和待完成练习</p></div><ArrowRight size={18} /></button>
        <button type="button" onClick={() => navigate("progress")}><span><Target size={20} /></span><div><strong>学习报告</strong><p>了解本周进度和薄弱知识点</p></div><ArrowRight size={18} /></button>
      </section>
    </div>
  );
}
