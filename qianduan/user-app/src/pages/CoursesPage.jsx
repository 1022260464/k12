import { ArrowRight, BookOpen, CheckCircle2, Clock3, LoaderCircle, Map as MapIcon, Search, SlidersHorizontal, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, knowledgeGraphApi, practiceApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { courses as visualCourses, realShowcaseCourses } from "../data/learningData.js";
import {
  courseMatchesLearningScope,
  EXPERIENCE,
  experienceForSchoolStage,
  learningProfileLabel,
} from "../experience/experience.js";

const fallbackImageFor = (course, index) => visualCourses.find((item) => item.subject === course.subject)?.image || visualCourses[index % visualCourses.length].image;
const imageFor = (course, index) => course.coverUrl || fallbackImageFor(course, index);

export function CoursesPage({ session, requireLogin, navigate, experience = EXPERIENCE.TEEN, learningProfile, onAskKnowledgePoint }) {
  const [subject, setSubject] = useState("全部");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState([]);
  const [history, setHistory] = useState([]);
  const [graph, setGraph] = useState(null);
  const [masteryMap, setMasteryMap] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // 未登录也能浏览课程目录（走公开推荐接口），报名和进度才需要登录。
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      session ? coursesApi.list() : coursesApi.recommended(8).catch(() => []),
      session ? coursesApi.history(20).catch(() => []) : Promise.resolve([]),
    ])
      .then(([courseList, historyValue]) => {
        if (!active) return;
        setCourses(Array.isArray(courseList) ? courseList : (courseList?.items || []));
        setHistory(Array.isArray(historyValue) ? historyValue : (historyValue?.items || []));
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [session]);

  useEffect(() => setSubject("全部"), [experience, learningProfile?.schoolStage]);

  // 知识地图（需求 §4.2 课程地图）：图谱目录+前置关系现成，掌握度走练习接口。
  useEffect(() => {
    if (!session) {
      setGraph(null);
      setMasteryMap(new Map());
      return undefined;
    }
    let active = true;
    Promise.allSettled([knowledgeGraphApi.overview(), practiceApi.mastery()])
      .then(([graphResult, masteryResult]) => {
        if (!active) return;
        const value = graphResult.status === "fulfilled" ? graphResult.value : null;
        setGraph(value && Array.isArray(value.points) && value.points.length
          ? { points: value.points, edges: Array.isArray(value.edges) ? value.edges : [] }
          : null);
        const rows = masteryResult.status === "fulfilled" ? masteryResult.value || [] : [];
        setMasteryMap(new Map(rows
          .filter((row) => row?.knowledgeCode)
          .map((row) => [row.knowledgeCode, Number(row.masteryPercent)])));
      });
    return () => { active = false; };
  }, [session]);

  // 未登录且公开接口没有数据时，展示平台真实发布的课程（真实课程 id，登录后点击直接进入课程详情）。
  const fallbackPreviews = useMemo(
    () => realShowcaseCourses
      .filter((course) => courseMatchesLearningScope(course.grade, learningProfile?.schoolStage, experience))
      .map((course) => ({
        id: course.id,
        title: course.title,
        subject: course.subject,
        gradeLevel: course.grade,
        description: course.next,
        coverUrl: course.image,
      })),
    [experience, learningProfile?.schoolStage],
  );

  const stageCourses = useMemo(() => {
    const apiCourses = courses.filter((course) => courseMatchesLearningScope(
      course.gradeLevel,
      learningProfile?.schoolStage,
      experience,
    ));
    return !session && apiCourses.length === 0 ? fallbackPreviews : apiCourses;
  }, [courses, session, fallbackPreviews, experience, learningProfile?.schoolStage]);
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
      {loading ? (
        <LoadingState label="正在加载课程" />
      ) : error ? (
        <EmptyState title="课程加载失败" description={error} action="重新加载" onAction={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        session
          ? <EmptyState title="暂无课程" description="当前筛选条件下没有可显示的课程。" />
          : <EmptyState title="登录后查看完整课程" description="课程目录按学习阶段筛选展示，登录后可查看全部并报名。" action="立即登录" onAction={() => requireLogin()} />
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
                {(experience !== EXPERIENCE.PRIMARY) && <p>{course.description || "课程暂未填写简介"}</p>}
                {progress && <div className="course-card-progress"><div><span style={{ width: `${Math.min(100, Math.max(0, Number(progress.progressPercent || 0)))}%` }} /></div><small>{progress.progressPercent}% · 已完成 {progress.completedChapters}/{progress.totalChapters} 章</small></div>}
                <button className="button secondary" type="button" onClick={() => openCourse(course)}>
                  <BookOpen size={17} />{session ? (experience === EXPERIENCE.PRIMARY ? "开始探险" : "进入课程") : "登录后报名"}<ArrowRight size={15} />
                </button>
              </div>
            </article>;
          })}
        </section>
      )}
      <StageLadder
        graph={graph}
        experience={experience}
        currentStage={profileMatchesExperience ? learningProfile?.schoolStage : null}
        onAskPoint={onAskKnowledgePoint}
        navigate={navigate}
      />
      {session && graph && (
        <KnowledgeMap
          graph={graph}
          masteryMap={masteryMap}
          stageLabel={STAGE_FILTER_LABELS[learningProfile?.schoolStage] || null}
          experience={experience}
          onAskPoint={onAskKnowledgePoint}
        />
      )}
    </div>
  );
}

const STAGE_FILTER_LABELS = {
  PRIMARY_LOWER: "小学低年级",
  PRIMARY_UPPER: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

const CATEGORY_EMOJI_RULES = [
  ["机器学习", "🤖"],
  ["人工智能", "🧠"],
  ["计算", "🧩"],
  ["数据", "📊"],
  ["伦理", "🛡️"],
  ["安全", "🛡️"],
  ["视觉", "👁️"],
  ["编程", "💻"],
];

function categoryEmoji(title) {
  const hit = CATEGORY_EMOJI_RULES.find(([keyword]) => (title || "").includes(keyword));
  return hit ? hit[1] : "✨";
}

/**
 * 课程地图：按主题分组展示知识点，标注难度、前置关系和完成状态（§4.2）。
 * 点卡片直接带知识点编码去问问小智，形成「课程 → 课堂」闭环。
 */
function KnowledgeMap({ graph, masteryMap, stageLabel, experience, onAskPoint }) {
  // 独立于上方课程搜索：这里的搜索只筛选知识地图的知识点卡片。
  const [query, setQuery] = useState("");
  const prereqByCode = useMemo(() => {
    const map = new Map();
    graph.edges
      .filter((edge) => edge.relation === "PREREQUISITE_OF")
      .forEach((edge) => {
        const list = map.get(edge.toCode) || [];
        list.push(edge.fromCode);
        map.set(edge.toCode, list);
      });
    return map;
  }, [graph]);
  const titleByCode = useMemo(() => new Map(graph.points.map((point) => [point.code, point.title])), [graph]);
  const isPrimary = experience === EXPERIENCE.PRIMARY;

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = graph.points
      .filter((point) => !stageLabel || (point.stages || []).includes(stageLabel))
      .filter((point) => !keyword
        || (point.title || "").toLowerCase().includes(keyword)
        || (point.code || "").toLowerCase().includes(keyword))
      // 星级递增：先学简单的（1★），带星星多的挑战放后面。
      .sort((left, right) => (Number(left.difficulty) || 1) - (Number(right.difficulty) || 1));
    const grouped = new Map();
    filtered.forEach((point) => {
      const key = point.categoryCode || "other";
      if (!grouped.has(key)) grouped.set(key, { title: point.categoryTitle || "其他主题", points: [] });
      grouped.get(key).points.push(point);
    });
    const list = [...grouped.values()];
    return isPrimary ? list.slice(0, 4) : list;
  }, [graph, stageLabel, isPrimary, query]);

  if (!groups.length && !query.trim()) return null;

  return (
    <section className="knowledge-map" aria-label="知识地图">
      <header className="knowledge-map-head">
        <span><MapIcon size={18} /></span>
        <div>
          <strong>{isPrimary ? "AI 知识小地图" : "知识地图"}</strong>
          <p>{isPrimary
            ? "先学下面的基础图标，再挑战带星星多的；点一张卡，小智就带你学。"
            : `按主题浏览知识点：难度、前置关系与掌握状态一目了然${stageLabel ? `（${stageLabel}）` : ""}；点卡片可让 AI 助教讲解。`}</p>
        </div>
        <label className="knowledge-map-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isPrimary ? "搜一搜知识点" : "搜索知识点"}
            title="只筛选知识地图里的知识点卡片"
          />
        </label>
      </header>
      {groups.length === 0 ? (
        <p className="knowledge-map-empty">没有找到与「{query.trim()}」匹配的知识点，换个关键词试试。</p>
      ) : groups.map((group) => (
        <div className="knowledge-map-group" key={group.title}>
          <h3>{categoryEmoji(group.title)} {group.title}</h3>
          <div className={`knowledge-point-grid${isPrimary ? " primary" : ""}`}>
            {group.points.map((point) => {
              const percent = masteryMap.get(point.code);
              const state = !Number.isFinite(percent)
                ? { cls: "todo", label: "待学习" }
                : percent >= 80
                  ? { cls: "done", label: `已掌握 ${Math.round(percent)}%` }
                  : percent >= 40
                    ? { cls: "learning", label: `学习中 ${Math.round(percent)}%` }
                    : { cls: "weak", label: `待巩固 ${Math.round(percent)}%` };
              const prereqs = (prereqByCode.get(point.code) || []).slice(0, 2);
              return (
                <button
                  className={`knowledge-point-card state-${state.cls}`}
                  type="button"
                  key={point.code}
                  onClick={() => onAskPoint?.(point)}
                >
                  <span className="kp-top" aria-hidden="true">
                    <span className="kp-emoji">{categoryEmoji(group.title)}</span>
                    <small className="kp-difficulty" title={`难度 ${point.difficulty || 1}/4`}>
                      {"★".repeat(Math.min(4, Math.max(1, point.difficulty || 1)))}
                    </small>
                  </span>
                  <strong>{point.title}</strong>
                  <span className={`kp-status ${state.cls}`}>{state.label}</span>
                  {prereqs.length > 0 && (
                    <span className="kp-prereqs">
                      {prereqs.map((code) => {
                        const prePct = masteryMap.get(code);
                        const weakPre = !Number.isFinite(prePct) || prePct < 60;
                        return (
                          <em key={code} className={weakPre ? "gap" : "ok"}>
                            {weakPre ? "先学：" : "前置·"}{titleByCode.get(code) || code}
                          </em>
                        );
                      })}
                    </span>
                  )}
                  <span className="kp-ask">{isPrimary ? "让小智讲给我听 →" : "问问 AI 助教 →"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * 四学段难度阶梯（P1-6）：以「循环 → 算法」同一主题为例，展示四个学段的内容与难度递进。
 * 四行入口全部是平台真实功能（积木实验室 / 图形化课程 / AI 小测 / 算法动画）；
 * 主题横跨四学段的依据来自知识图谱（visual_programming.loops），未登录评委也能看到。
 */
const STAGE_LADDER = [
  {
    key: "PRIMARY_LOWER", label: "小学低年级", stars: 1,
    title: "积木实验室 · 循环积木",
    desc: "拖一块「重复执行」积木，让角色转圈圈——不用写字，先看懂“重复”。",
    action: "去玩循环积木", go: ({ navigate }) => navigate("visual-code-lab"),
  },
  {
    key: "PRIMARY_UPPER", label: "小学高年级", stars: 2,
    title: "《图形化编程与智能小车》",
    desc: "用循环积木控制小车重复走路线：同一块积木，跑完整圈路线。",
    action: "去看这门课", go: ({ navigate }) => navigate("courses"),
  },
  {
    key: "JUNIOR_HIGH", label: "初中", stars: 3,
    title: "AI 小测 · 循环与重复",
    desc: "在 Python 代码里写循环，提交后当场判分，成绩记入学习画像。",
    action: "来一次小测", go: ({ onAskPoint }) => onAskPoint?.({ title: "循环与重复", code: "computing.loop_basics" }),
  },
  {
    key: "SENIOR_HIGH", label: "高中", stars: 4,
    title: "算法动画 · 冒泡排序",
    desc: "看冒泡排序如何一步步比较与交换，再进代码实验自己跑一遍。",
    action: "看动画演示", go: ({ onAskPoint }) => onAskPoint?.({ title: "冒泡排序", code: "sorting.bubble_sort" }),
  },
];

function StageLadder({ graph, experience, currentStage, onAskPoint, navigate }) {
  const isPrimary = experience === EXPERIENCE.PRIMARY;
  const loopsPoint = (graph?.points || []).find((point) => point.code === "visual_programming.loops");
  const spansAll = (loopsPoint?.stages || []).length >= 4;
  return (
    <section className="stage-ladder" aria-label="同一主题四个学段的难度进阶">
      <header className="stage-ladder-head">
        <span><TrendingUp size={18} /></span>
        <div>
          <strong>{isPrimary ? "同一个主题，越学越厉害" : "同一主题 · 四学段进阶"}</strong>
          <p>{isPrimary
            ? "看看「重复」这个本领在不同年级怎么玩：从积木一步步走到真正的算法。"
            : "以「循环 → 算法」为例：同一主题在四个学段的内容与难度递进，每个入口都是平台真实功能。"}</p>
        </div>
        {spansAll && <em className="stage-ladder-kg">知识图谱：该主题横跨 4 个学段</em>}
      </header>
      <ol className={`stage-ladder-track${isPrimary ? " primary" : ""}`}>
        {STAGE_LADDER.map((step) => (
          <li key={step.key} className={step.key === currentStage ? "current" : ""}>
            <div className="stage-ladder-card">
              <small>{step.label}{step.key === currentStage ? " · 当前学段" : ""}</small>
              <strong>{step.title}</strong>
              <p>{step.desc}</p>
              <div className="stage-ladder-foot">
                <span className="stage-ladder-stars" title={`学段难度 ${step.stars}/4`} aria-label={`学段难度 ${step.stars} 星（共 4 星）`}>
                  {"★".repeat(step.stars)}{"☆".repeat(4 - step.stars)}
                </span>
                <button type="button" onClick={() => step.go({ navigate, onAskPoint })}>
                  {step.action}<ArrowRight size={14} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="stage-ladder-note">难度星表示同一主题随学段的内容深度递进；主题的学段覆盖与难度数据来自平台知识图谱（重复执行与循环积木，难度 {loopsPoint?.difficulty || 1}/4）。</p>
    </section>
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
