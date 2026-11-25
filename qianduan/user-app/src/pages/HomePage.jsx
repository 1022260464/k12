import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileText,
  FlaskConical,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { coursesApi, diagnosticsApi } from "../api/client.js";
import { DailyLearningPlan } from "../components/DailyLearningPlan.jsx";
import { LearningRhythm } from "../components/LearningRhythm.jsx";
import { ParticleField } from "../components/ParticleField.jsx";
import { courses as fallbackCourses } from "../data/learningData.js";
import { courseMatchesLearningScope, EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

const fallbackImageFor = (course, index) => fallbackCourses.find((item) => item.subject === course.subject)?.image
  || fallbackCourses[index % fallbackCourses.length].image;

const asCourseCard = (course, index) => ({
  id: course.id,
  title: course.title,
  subject: course.subject,
  grade: course.gradeLevel || course.grade,
  next: course.description?.trim()?.slice(0, 28) || "打开课程查看章节",
  image: course.coverUrl || fallbackImageFor(course, index),
});

export function HomePage({ session, displayName, navigate, requireLogin, onAskTopic, experience = EXPERIENCE.TEEN, schoolStage }) {
  const railRef = useRef(null);
  const [recommended, setRecommended] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [needsDiagnostic, setNeedsDiagnostic] = useState(false);
  const primary = experience === EXPERIENCE.PRIMARY;
  const visuals = visualsFor(experience);

  const scrollCourses = (direction) => railRef.current?.scrollBy({
    left: direction * 380,
    behavior: "smooth",
  });

  useEffect(() => {
    if (!session) {
      setRecommended([]);
      setHistory([]);
      setNeedsDiagnostic(false);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.allSettled([
      coursesApi.recommended(8),
      coursesApi.history(10),
      diagnosticsApi.latest(),
    ]).then(([recommendationResult, historyResult, diagnosticResult]) => {
      if (!active) return;
      setRecommended(recommendationResult.status === "fulfilled" && Array.isArray(recommendationResult.value)
        ? recommendationResult.value
        : []);
      const historyValue = historyResult.status === "fulfilled" ? historyResult.value : null;
      setHistory(historyValue?.items || historyValue || []);
      setNeedsDiagnostic(diagnosticResult.status === "fulfilled" && !diagnosticResult.value);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  const activeCourse = useMemo(() => history.find((course) => {
    const progress = Number(course.progressPercent || 0);
    return progress > 0 && progress < 100;
  }) || null, [history]);

  const showcase = useMemo(() => {
    const scopedRecommendations = recommended.filter((course) => (
      courseMatchesLearningScope(course.gradeLevel, schoolStage, experience)
    ));
    const scopedFallbacks = fallbackCourses.filter((course) => (
      courseMatchesLearningScope(course.grade, schoolStage, experience)
    ));
    return (scopedRecommendations.length ? scopedRecommendations : scopedFallbacks)
      .map(asCourseCard);
  }, [experience, recommended, schoolStage]);

  function startPrimaryMission() {
    if (activeCourse?.courseId) navigate(`courses/${activeCourse.courseId}`);
    else requireLogin(() => navigate("cat-lesson"));
  }

  function startTeenResearch() {
    if (activeCourse?.courseId) requireLogin(() => navigate(`courses/${activeCourse.courseId}`));
    else onAskTopic?.({ title: "图像分类", code: "image-classification" });
  }

  return (
    <div className="page home-page">
      <ParticleField experience={experience} />

      <aside className="home-side-rail home-side-rail-left" aria-label="今日学习入口">
        <img src={visuals.mascot} alt="" aria-hidden="true" />
        <small>{primary ? "今天去哪里探险？" : "今日学习入口"}</small>
        <strong>{primary ? "选一个喜欢的任务开始" : "保持清晰的学习节奏"}</strong>
        <button type="button" onClick={() => navigate("courses")}><BookOpen size={16} />{primary ? "探索课程" : "继续课程"}</button>
        <button type="button" onClick={() => navigate("tasks")}><ClipboardCheck size={16} />{primary ? "趣味任务" : "查看作业"}</button>
        <button type="button" onClick={() => navigate("challenge")}><Trophy size={16} />{primary ? "闯关乐园" : "知识闯关"}</button>
      </aside>

      <aside className="home-side-rail home-side-rail-right" aria-label="快捷学习工具">
        <img src={visuals.encouragement} alt="" aria-hidden="true" />
        <small>{primary ? "小智随时陪着你" : "快捷学习工具"}</small>
        <strong>{primary ? "遇到问题就来问我" : "从问题回到行动"}</strong>
        <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><MessageCircle size={16} />{primary ? "问问小智" : "打开 AI"}</button>
        <button type="button" onClick={() => navigate("progress")}><BarChart3 size={16} />{primary ? "我的成长" : "学习报告"}</button>
      </aside>

      {primary ? (
        <div className="primary-stage">
          <svg className="primary-stage-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 78 16 C 92 28, 64 34, 34 41 C 22 44, 12 46, 4 49" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="3" strokeLinecap="round" strokeDasharray=".3 2.6" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="primary-stage-cloud primary-stage-cloud-a" aria-hidden="true" />
          <span className="primary-stage-cloud primary-stage-cloud-b" aria-hidden="true" />
          <span className="primary-stage-cloud primary-stage-cloud-c" aria-hidden="true" />
          <span className="primary-stage-warmth" aria-hidden="true" />

          <section className="primary-space-hero" aria-label="AI 星球学院">
            <div className="primary-space-copy">
              <p className="primary-brand">AI 星球学院</p>
              <p className="primary-brand-slogan">用好奇心，点亮更大的世界！</p>
              <h1 className="primary-space-greet">{session ? `${displayName}，今天去哪儿探险？` : "今天去哪儿探险？"}</h1>
              <p className="primary-space-note"><Sparkles size={16} />每一个问题，都是一颗闪闪发光的星星</p>
            </div>
            <div className="primary-stage-cast">
              <span className="primary-cast-bubble" aria-hidden="true">跟我去找小猫线索！</span>
              <img className="primary-space-art" src={visuals.mascot} alt="小智为你带路" />
              <img className="primary-cast-explorer" src={visuals.heroStudent} alt="" aria-hidden="true" loading="lazy" />
            </div>
          </section>

          <section className="primary-quest" aria-label="和小智聊聊 · 今日冒险">
            <span className="primary-stage-badge" aria-hidden="true">第 1 站</span>
            <article className="primary-chat-card">
              <header className="primary-chat-head">
                <img className="primary-chat-avatar" src={visuals.mascot} alt="" aria-hidden="true" />
                <div className="primary-chat-title">
                  <h2>和小智聊聊<span className="primary-online"><span aria-hidden="true" />在线</span></h2>
                  <p>有问题就来找我吧！一起探索更大的世界～</p>
                </div>
              </header>
              <div className="primary-quest-body">
                <small>{activeCourse ? "接着上次学" : "今日冒险主任务"}</small>
                <strong>{activeCourse?.courseTitle || "AI 为什么能认出小猫？"}</strong>
                <p>{activeCourse
                  ? `已经完成 ${Math.round(Number(activeCourse.progressPercent || 0))}%，继续探险就能解锁新线索！`
                  : "像小侦探一样找线索，看看 AI 是怎么认出小猫的。"}</p>
                <button className="primary-cta" type="button" onClick={startPrimaryMission}>
                  {activeCourse ? "继续今天的探险" : "开始今天的冒险"}<ArrowRight size={18} />
                </button>
              </div>
              <div className="primary-chips">
                <button type="button" className="primary-chip primary-chip-red" onClick={() => navigate("picture-books")}>
                  <span className="primary-chip-icon"><BookOpen size={22} /></span>
                  <span className="primary-chip-copy"><strong>看绘本</strong><small>翻页听故事，找 AI 小线索</small></span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button type="button" className="primary-chip primary-chip-green" onClick={() => navigate("coursewares")}>
                  <span className="primary-chip-icon"><FileText size={22} /></span>
                  <span className="primary-chip-copy"><strong>图解原理</strong><small>一页页看懂 AI 怎么认猫</small></span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button type="button" className="primary-chip primary-chip-yellow" onClick={() => navigate("tasks")}>
                  <span className="primary-chip-icon"><Trophy size={22} /></span>
                  <span className="primary-chip-copy"><strong>来个小游戏</strong><small>完成今天的成长挑战</small></span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
              <button type="button" className="primary-askbar" onClick={() => requireLogin(() => navigate("ai-studio"))}>
                <span className="primary-askbar-lead"><MessageCircle size={18} /></span>
                <span className="primary-askbar-text">问问小智任何问题…</span>
                <span className="primary-askbar-send"><Send size={16} /></span>
              </button>
              <p className="primary-quest-foot">好问题，让你离更大的世界更近一步！</p>
            </article>
          </section>
        </div>
      ) : (
        <section className="teen-stage research-stage" aria-label="云端 AI 研究学院">
          <div className="teen-stage-copy">
            <p className="eyebrow teen-stage-eyebrow">云端 AI 研究学院 · 图像分类专题</p>
            <h1>让 AI 看见你眼中的世界</h1>
            <p>研究问题：AI 是怎么从一张照片里认出小猫的？带着它去观察、实验，找到你自己的解释。</p>
            {activeCourse && <p className="teen-stage-continue">上次学到《{activeCourse.courseTitle}》 · 已完成 {Math.round(Number(activeCourse.progressPercent || 0))}%</p>}
            <div className="hero-actions">
              <button className="button teen-cta" type="button" onClick={startTeenResearch}>
                <BookOpen size={17} />{activeCourse ? "继续今天的探索" : "开始今天的研究"}
              </button>
              <button className="text-button teen-stage-alt" type="button" onClick={() => onAskTopic?.({ title: "图像分类", code: "image-classification" })}>
                先看特征动画<ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="research-path" aria-label="研究路径">
            <header className="research-path-head">
              <h2>今天的研究路径</h2>
              <p>AI 是怎么从一张照片里认出小猫的？</p>
            </header>
            <ol className="research-path-steps">
              <li><button type="button" onClick={() => onAskTopic?.({ title: "图像分类", code: "image-classification" })}><span className="research-step-no"><Eye size={16} />01</span><strong>观察</strong><small>看特征动画，找出 AI 认猫的线索</small></button></li>
              <li><button type="button" onClick={() => navigate("code-lab")}><span className="research-step-no"><FlaskConical size={16} />02</span><strong>理解</strong><small>进实验室做分类实验，弄懂原理</small></button></li>
              <li><button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><span className="research-step-no"><MessageCircle size={16} />03</span><strong>验证</strong><small>向 AI 教练求证你的猜想</small></button></li>
              <li><button type="button" onClick={() => navigate("progress")}><span className="research-step-no"><BarChart3 size={16} />04</span><strong>解释</strong><small>整理证据，写下你的结论</small></button></li>
            </ol>
          </div>
          <p className="teen-stage-note">研究路径对应真实学习入口；你的完成进度以课程学习记录为准。</p>
        </section>
      )}

      <DailyLearningPlan session={session} navigate={navigate} onAskTopic={onAskTopic} experience={experience} />
      {session && <LearningRhythm session={session} navigate={navigate} experience={experience} className="home-learning-rhythm" />}

      {session && needsDiagnostic && (
        <section className="diagnostic-nudge" aria-label="首次学情诊断">
          <span className="diagnostic-nudge-icon"><Sparkles size={20} /></span>
          <div>
            <strong>{primary ? "让小智先认识你一下" : "还没有学习画像"}</strong>
            <p>{primary ? "花 2 分钟做个小诊断，小智就能帮你挑最合适的课程和题目。" : "完成首次学情诊断，生成优势、薄弱点与推荐起点。"}</p>
          </div>
          <button className="button primary" type="button" onClick={() => navigate("diagnostic")}>
            开始诊断<ArrowRight size={15} />
          </button>
        </section>
      )}

      <section className="home-section course-showcase">
        <header className="section-heading">
          <div>
            <p className="eyebrow">{primary ? (session ? "平台真实课程" : "为你准备") : "推荐课程"}</p>
            <h2>{primary ? "选择一场新的探索" : "从感兴趣的课程开始"}</h2>
            <p>{session
              ? (primary ? "从绘本、实验和图形化编程中认识人工智能。" : "覆盖学科基础、科学探究和编程创造，按当前学段筛选。")
              : "登录后可查看平台已发布课程推荐。"}</p>
          </div>
          <div className="carousel-actions">
            <button className="icon-button" type="button" title="上一组课程" onClick={() => scrollCourses(-1)}><ChevronLeft size={18} /></button>
            <button className="icon-button" type="button" title="下一组课程" onClick={() => scrollCourses(1)}><ChevronRight size={18} /></button>
          </div>
        </header>
        {session && loading ? (
          <div className="empty-state" style={{ minHeight: 180 }}><LoaderCircle className="spin" size={22} /><p>正在加载推荐课程</p></div>
        ) : (
          <div className="visual-course-rail" ref={railRef}>
            {showcase.map((course) => (
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
            ))}
          </div>
        )}
      </section>

      {primary ? (
        <section className="home-section home-shortcuts" aria-label="小学端快捷入口">
          <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><img src={visuals.ai} alt="" /><div><strong>问问小智</strong><p>有问题随时问，也可以听故事</p></div><ArrowRight size={18} /></button>
          <button type="button" onClick={() => navigate("courses")}><img src={visuals.courses} alt="" /><div><strong>继续探索</strong><p>回到上次学习的有趣知识</p></div><ArrowRight size={18} /></button>
          <button type="button" onClick={() => navigate("tasks")}><img src={visuals.tasks} alt="" /><div><strong>今日挑战</strong><p>完成老师布置的小任务</p></div><ArrowRight size={18} /></button>
          <button type="button" onClick={() => navigate("challenge")}><img src={visuals.progress} alt="" /><div><strong>闯关乐园</strong><p>闯一关拿一颗星，积分上排行</p></div><ArrowRight size={18} /></button>
          <button type="button" onClick={() => navigate("progress")}><img src={visuals.progress} alt="" /><div><strong>成长记录</strong><p>看看新进步和获得的成绩</p></div><ArrowRight size={18} /></button>
        </section>
      ) : (
        <>
          <section className="home-section teen-actions" aria-label="研究入口">
            <button type="button" onClick={() => onAskTopic?.({ title: "图像分类", code: "image-classification" })}><img src={visuals.ai} alt="" /><div><small>观察</small><strong>特征动画</strong><p>看动画、分步看清 AI 提取了哪些特征。</p></div><ArrowRight size={18} /></button>
            <button type="button" onClick={() => navigate("code-lab")}><img src={visuals.code} alt="" /><div><small>实验</small><strong>分类实验</strong><p>亲手调整参数，跑出真实的分类结果。</p></div><ArrowRight size={18} /></button>
            <button type="button" onClick={() => requireLogin(() => navigate("ai-studio"))}><img src={visuals.science} alt="" /><div><small>解释</small><strong>解释判断</strong><p>和 AI 教练对话，说出并检验判断依据。</p></div><ArrowRight size={18} /></button>
            <button type="button" onClick={() => navigate("challenge")}><img src={visuals.tasks} alt="" /><div><small>巩固</small><strong>知识闯关</strong><p>把学过的知识点闯成关，成绩计入排行榜。</p></div><ArrowRight size={18} /></button>
          </section>
          <section className="teen-challenge" aria-label="迁移挑战">
            <div>
              <small>迁移挑战</small>
              <strong>模型为什么会把两张相似图片分错？</strong>
              <p>带着你的猜想去找 AI 教练验证，看看判断依据藏在哪里。</p>
            </div>
            <button className="button ghost teen-challenge-cta" type="button" onClick={() => onAskTopic?.({ title: "模型为什么会把两张相似图片分错", code: "classification-errors" })}>
              去问 AI 教练<ArrowRight size={16} />
            </button>
          </section>
        </>
      )}
    </div>
  );
}
