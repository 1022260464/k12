import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Headphones,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursewaresApi } from "../api/client.js";
import { CoursewarePlayer } from "../components/CoursewarePlayer.jsx";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import {
  COURSEWARE_MIME,
  fallbackCoursewares,
  normalizeCourseware,
} from "../data/coursewareFallback.js";
import { EXPERIENCE } from "../experience/experience.js";

const STAGES = [
  { key: "lower_primary", label: "小学低年级", profileStage: "PRIMARY_LOWER" },
  { key: "upper_primary", label: "小学高年级", profileStage: "PRIMARY_UPPER" },
  { key: "middle_school", label: "初中", profileStage: "JUNIOR_HIGH" },
  { key: "high_school", label: "高中", profileStage: "SENIOR_HIGH" },
];

export function CoursewaresPage({ session, requireLogin, experience = EXPERIENCE.TEEN, learningProfile }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    coursewaresApi.listPublished()
      .then((value) => {
        if (!active) return;
        const remote = (Array.isArray(value) ? value : []).map(normalizeCourseware).filter(Boolean);
        setItems(remote.length ? remote : fallbackCoursewares);
        setUsingFallback(remote.length === 0);
      })
      .catch((requestError) => {
        if (!active) return;
        setItems(fallbackCoursewares);
        setUsingFallback(true);
        if (requestError.status !== 404) setError("在线课件暂时不可用，当前展示内置演示课件。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const stageGroups = useMemo(() => {
    const profileStage = learningProfile?.schoolStage;
    const currentStage = STAGES.find((stage) => stage.profileStage === profileStage);
    const visible = currentStage
      ? STAGES.filter((stage) => stage.key === currentStage.key)
      : STAGES;
    return visible.map((stage) => ({
      ...stage,
      items: items.filter((item) => item.stage === stage.key),
    })).filter((stage) => stage.items.length);
  }, [items, learningProfile?.schoolStage]);

  async function openCourseware(item) {
    if (!session) {
      requireLogin();
      return;
    }
    if (item.localDemo || item.document?.slides?.length) {
      setSelected(normalizeCourseware(item));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const detail = normalizeCourseware(await coursewaresApi.getPublished(item.coursewareId));
      if (!detail?.document?.slides?.length) throw new Error("这份课件暂时打不开，请稍后再试");
      setSelected(detail);
    } catch (requestError) {
      setError(requestError.message || "课件加载失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  if (selected) {
    return (
      <div className="page inner-page coursewares-page">
        <button className="button ghost back-button" type="button" onClick={() => setSelected(null)}>
          <ArrowLeft size={16} />返回课件列表
        </button>
        <CoursewarePlayer courseware={selected} />
      </div>
    );
  }

  return (
    <div className="page inner-page coursewares-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={primary ? <><Sparkles size={14} />小智课件书架</> : <><BookOpenCheck size={14} />老师审核过的 AI 课件</>}
        title="AI 课件"
        description={primary ? "点开课件，跟小智一页一页学，还能边学边答题。" : "由老师用 AI 生成并审核发布的互动课件，边看边答，学完即测。"}
        imageKey="courses"
      >
        <ul className="courseware-hero-points" aria-label="课件亮点">
          <li><BookOpenCheck size={14} />翻页互动课堂</li>
          <li><CheckCircle2 size={14} />随堂小题即练</li>
          <li><ShieldCheck size={14} />审核后发布</li>
        </ul>
      </ExperiencePageHeader>

      {usingFallback && <p className="courseware-fallback-note"><Sparkles size={15} />在线课件接口尚未返回已发布内容，当前使用本机演示课件。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <div className="loading-state"><LoaderCircle className="spin" size={22} />正在整理课件书架</div>
      ) : !stageGroups.length ? (
        <section className="empty-state">
          <BookOpenCheck size={36} />
          <h2>这个学段还没有课件</h2>
          <p>老师发布新课件后会出现在这里。</p>
        </section>
      ) : stageGroups.map((stage) => (
        <section className="courseware-stage-group" aria-label={`${stage.label}课件`} key={stage.key}>
          <header className="courseware-stage-head">
            <p className="eyebrow">{stage.label}</p>
            <h2>{stage.label} · 适合这一学段的课件</h2>
            <small>{stage.items.length} 份</small>
          </header>
          <div className="courseware-grid">
            {stage.items.map((item) => (
              <article className="courseware-card" key={item.coursewareId}>
                <div className="courseware-card-icon"><BookOpenCheck size={22} /></div>
                <h2>{item.title}</h2>
                <p className="courseware-card-meta">{stage.label} · {item.slideCount} 页</p>
                {item.localDemo && <span className="courseware-card-demo">本机演示</span>}
                <button className="button primary" type="button" onClick={() => openCourseware(item)}>
                  {session ? "开始学习" : "登录后学习"}<CheckCircle2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer className="auth-gate-features courseware-shelf-note">
        <article><ShieldCheck size={17} /><strong>审核发布</strong><span>AI 生成的课件经过审核后才进入书架。</span></article>
        <article><BookOpenCheck size={17} /><strong>一页一页学</strong><span>图、文、例子分页讲解，随时回看。</span></article>
        <article><Headphones size={17} /><strong>边听边答</strong><span>支持云语音朗读和随堂小题。</span></article>
      </footer>
    </div>
  );
}
