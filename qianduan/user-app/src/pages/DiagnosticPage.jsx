import {
  BarChart3,
  CheckCircle2,
  Heart,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { diagnosticsApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { EXPERIENCE } from "../experience/experience.js";

const STAGES = [
  ["lower_primary", "小学低年级"],
  ["upper_primary", "小学高年级"],
  ["middle_school", "初中"],
  ["high_school", "高中"],
];

const STAGE_BY_PROFILE = {
  PRIMARY_LOWER: "lower_primary",
  PRIMARY_UPPER: "upper_primary",
  JUNIOR_HIGH: "middle_school",
  SENIOR_HIGH: "high_school",
};

const INTERESTS = ["AI 绘画", "编程", "机器人", "数据", "科学", "游戏设计", "阅读", "安全"];

const LOCAL_PAPER = [
  {
    id: "diag-1",
    categoryCode: "ai_overview",
    categoryTitle: "人工智能概论",
    prompt: "下面哪一项更像人工智能在完成任务？",
    options: [
      { id: "a", text: "相册自动把照片分成“猫”和“狗”" },
      { id: "b", text: "台灯按下开关后亮起来" },
      { id: "c", text: "铅笔在纸上写字" },
    ],
    answer: "a",
  },
  {
    id: "diag-2",
    categoryCode: "machine_learning",
    categoryTitle: "机器学习",
    prompt: "机器学习最需要哪一种材料？",
    options: [
      { id: "a", text: "很多带标签的例子" },
      { id: "b", text: "一张空白纸" },
      { id: "c", text: "一把尺子" },
    ],
    answer: "a",
  },
  {
    id: "diag-3",
    categoryCode: "algorithm",
    categoryTitle: "算法与编程",
    prompt: "“把大象装进冰箱”要先分几步，体现的是什么？",
    options: [
      { id: "a", text: "算法步骤" },
      { id: "b", text: "图片分辨率" },
      { id: "c", text: "密码长度" },
    ],
    answer: "a",
  },
  {
    id: "diag-4",
    categoryCode: "data_literacy",
    categoryTitle: "数据素养",
    prompt: "柱状图中一根柱子更高，通常表示什么？",
    options: [
      { id: "a", text: "这一类数量更多" },
      { id: "b", text: "这一类颜色更深" },
      { id: "c", text: "页面加载更快" },
    ],
    answer: "a",
  },
  {
    id: "diag-5",
    categoryCode: "responsible_ai",
    categoryTitle: "负责任 AI",
    prompt: "AI 给出的学习答案和教材不一致时，应该怎么做？",
    options: [
      { id: "a", text: "核对教材或请老师确认" },
      { id: "b", text: "一定相信 AI" },
      { id: "c", text: "把答案删掉" },
    ],
    answer: "a",
  },
  {
    id: "diag-6",
    categoryCode: "digital_citizenship",
    categoryTitle: "数字公民",
    prompt: "下面哪个密码更结实？",
    options: [
      { id: "a", text: "123456" },
      { id: "b", text: "xiaoming" },
      { id: "c", text: "Cat7-Rain!92" },
    ],
    answer: "c",
  },
];

export function DiagnosticPage({ session, requireLogin, navigate, experience = EXPERIENCE.TEEN, schoolStage }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  const [stage, setStage] = useState(STAGE_BY_PROFILE[schoolStage] || (primary ? "lower_primary" : "middle_school"));
  const [mode, setMode] = useState("intro");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [interests, setInterests] = useState([]);
  const [latest, setLatest] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [localDemo, setLocalDemo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    diagnosticsApi.latest()
      .then((value) => { if (active) setLatest(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session]);

  const allAnswered = questions.length > 0 && questions.every((question) => answers[question.id]);
  const currentStageLabel = useMemo(() => STAGES.find(([key]) => key === stage)?.[1] || "当前学段", [stage]);

  async function startDiagnostic() {
    if (!session) {
      requireLogin();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const paper = await diagnosticsApi.paper(stage);
      const normalized = Array.isArray(paper) ? paper : paper?.questions;
      if (!Array.isArray(normalized) || !normalized.length) throw new Error("诊断题目暂时为空");
      setQuestions(normalized);
      setAnswers({});
      setLocalDemo(false);
      setMode("paper");
    } catch (requestError) {
      setQuestions(LOCAL_PAPER);
      setAnswers({});
      setLocalDemo(true);
      setMode("paper");
      if (requestError.status !== 404) setError("在线诊断暂时不可用，本次使用本机演示题，结果不会写入学习档案。");
    } finally {
      setLoading(false);
    }
  }

  async function submitDiagnostic() {
    if (!allAnswered) {
      setError(primary ? "还有小题没选完，选完再交哦" : "请回答全部题目后再提交");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (localDemo) {
        setResult(buildLocalResult(questions, answers, stage, interests));
        setMode("result");
        return;
      }
      const value = await diagnosticsApi.submit({
        stage,
        answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
        interests,
      });
      setResult(value);
      setLatest(value);
      setMode("result");
    } catch (requestError) {
      setResult(buildLocalResult(questions, answers, stage, interests));
      setLocalDemo(true);
      setMode("result");
      setError("提交服务暂时不可用，已生成本次本机演示画像，未写入数据库。");
      if (requestError.status !== 404 && requestError.message) setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleInterest(value) {
    setInterests((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value].slice(0, 5));
  }

  function restart() {
    setResult(null);
    setMode("intro");
    setAnswers({});
    setInterests([]);
  }

  return (
    <div className="page inner-page diagnostic-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={<><Sparkles size={14} />{primary ? "小智了解你" : "LEARNING DIAGNOSTIC"}</>}
        title={primary ? "做个小诊断，让小智更懂你" : "首次学情诊断，生成专属画像"}
        description={primary
          ? "回答 6 道小题，告诉小智你喜欢什么。小智会知道从哪里开始陪你学最合适。"
          : "6 道分层题目覆盖核心知识类别，完成后生成优势、薄弱点与推荐起点。"}
        imageKey="science"
        note={primary ? "没有分数压力，凭感觉选就好" : "形成性引导，不计入正式成绩"}
      />

      {!session ? (
        <section className="empty-state">
          <Target size={34} />
          <h2>登录后开始诊断</h2>
          <p>诊断结果属于个人学习数据，需要登录后生成。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      ) : mode === "result" && result ? (
        <DiagnosticResult result={result} primary={primary} localDemo={localDemo} navigate={navigate} onRetry={restart} />
      ) : mode === "paper" ? (
        <section className="diagnostic-workspace">
          <div className="diagnostic-questions">
            {localDemo && <p className="diagnostic-local-note"><Sparkles size={15} />本机演示诊断，结果不会计入服务端学习画像</p>}
            {questions.map((question, index) => (
              <fieldset key={question.id}>
                <legend>
                  <small>第 {index + 1} 题 · {question.categoryTitle || "学习画像"}</small>
                  <strong>{question.prompt}</strong>
                </legend>
                {question.options.map((option) => (
                  <label className={answers[question.id] === option.id ? "checked" : ""} key={option.id}>
                    <input
                      type="radio"
                      name={`diagnostic-${question.id}`}
                      checked={answers[question.id] === option.id}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <aside className="diagnostic-side">
            <section className="diagnostic-interests">
              <header><Heart size={16} /><strong>{primary ? "你喜欢什么？选 1-5 个" : "兴趣方向（选 1-5 个）"}</strong></header>
              <div className="diagnostic-interest-chips">
                {INTERESTS.map((interest) => (
                  <button className={interests.includes(interest) ? "active" : ""} type="button" key={interest} onClick={() => toggleInterest(interest)}>{interest}</button>
                ))}
              </div>
            </section>
            <button className="button primary diagnostic-submit" type="button" disabled={loading} onClick={submitDiagnostic}>
              {loading ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
              {primary ? "交卷，看看我的画像" : "提交并生成画像"}
            </button>
            <p className="diagnostic-note">诊断是形成性引导，不计入正式成绩。</p>
          </aside>
        </section>
      ) : (
        <section className="diagnostic-intro-card">
          {latest && (
            <p className="diagnostic-existing"><CheckCircle2 size={15} />你已完成过一次诊断（{latest.scorePercent ?? 0} 分 · {formatTime(latest.createdTime)}），可以重新做来更新画像。</p>
          )}
          <h2>{primary ? "先选一选你在哪个学段" : "选择当前学段"}</h2>
          <div className="diagnostic-stage-row">
            {STAGES.map(([value, label]) => (
              <button className={stage === value ? "active" : ""} type="button" key={value} onClick={() => setStage(value)}>{label}</button>
            ))}
          </div>
          <button className="button primary" type="button" disabled={loading} onClick={startDiagnostic}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <Zap size={16} />}
            {loading ? "正在出题" : primary ? "开始诊断" : "开始诊断（约 2 分钟）"}
          </button>
          <p className="diagnostic-note">当前选择：{currentStageLabel}。诊断题用于生成初始画像与推荐起点。</p>
        </section>
      )}

      {error && <p className={localDemo ? "diagnostic-local-note" : "page-error"} role="alert">{error}</p>}
    </div>
  );
}

function DiagnosticResult({ result, primary, localDemo, navigate, onRetry }) {
  const categories = Array.isArray(result.categories) ? result.categories : [];
  return (
    <section className="diagnostic-result">
      {localDemo && <p className="diagnostic-local-note"><Sparkles size={15} />本机演示画像，未写入服务端学习档案</p>}
      <div className="diagnostic-result-banner">
        <span><BarChart3 size={22} /></span>
        <div>
          <small>我的学习画像 · {STAGES.find(([key]) => key === result.stage)?.[1] || result.stage}</small>
          <h2>{primary ? `答对了 ${result.correctCount}/${result.totalQuestions} 题，小智认识你啦！` : `总体掌握 ${result.scorePercent}%（答对 ${result.correctCount}/${result.totalQuestions}）`}</h2>
          <p>{localDemo ? "本次只用于预览诊断体验，不会更新推荐。" : "画像由服务端生成，会随练习与对话持续更新。"}</p>
        </div>
      </div>
      <div className="diagnostic-result-grid">
        <section className="diagnostic-categories">
          <h3><BarChart3 size={15} />各类别掌握</h3>
          {categories.map((category) => (
            <article key={category.categoryCode}>
              <header><strong>{category.categoryTitle}</strong><span>{category.correct}/{category.total} · {category.percent}%</span></header>
              <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, category.percent))}%` }} /></div>
            </article>
          ))}
        </section>
        <aside className="diagnostic-profile-side">
          <section className="diagnostic-strengths">
            <h3><CheckCircle2 size={15} />优势</h3>
            {result.strengths?.length
              ? <div className="diagnostic-chip-row">{result.strengths.map((item) => <span className="diagnostic-chip tone-good" key={item}>{item}</span>)}</div>
              : <p>继续保持，第一次诊断都是起点。</p>}
          </section>
          <section className="diagnostic-weaknesses">
            <h3><Target size={15} />建议加强</h3>
            {result.weaknesses?.length
              ? result.weaknesses.map((item) => <p key={item.categoryTitle}>{item.categoryTitle} · {item.percent}%</p>)
              : <p>本次全对，可以直接进入拓展主题。</p>}
          </section>
          <section className="diagnostic-recommend">
            <h3><Sparkles size={15} />推荐起点</h3>
            <p>{result.recommendedStart?.knowledgeCode || "完成更多练习后生成"}</p>
            <button className="button primary" type="button" onClick={() => navigate("ai-studio")}>{primary ? "让小智带我学" : "去 AI 学习台开始"}</button>
            <button className="text-button" type="button" onClick={() => navigate("progress")}>查看学习报告</button>
          </section>
        </aside>
      </div>
      <button className="text-button diagnostic-redo" type="button" onClick={onRetry}><RotateCcw size={14} />重新诊断</button>
    </section>
  );
}

function buildLocalResult(questions, answers, stage, interests) {
  const categoryMap = new Map();
  let correctCount = 0;
  questions.forEach((question) => {
    const categoryCode = question.categoryCode || "general";
    const categoryTitle = question.categoryTitle || "综合";
    const current = categoryMap.get(categoryCode) || { categoryCode, categoryTitle, correct: 0, total: 0 };
    current.total += 1;
    const correct = answers[question.id] === question.answer;
    if (correct) {
      current.correct += 1;
      correctCount += 1;
    }
    categoryMap.set(categoryCode, current);
  });
  const categories = [...categoryMap.values()].map((item) => ({
    ...item,
    percent: item.total ? Math.round((item.correct / item.total) * 100) : 0,
  }));
  return {
    stage,
    correctCount,
    totalQuestions: questions.length,
    scorePercent: questions.length ? Math.round((correctCount / questions.length) * 100) : 0,
    categories,
    strengths: categories.filter((item) => item.percent >= 80).map((item) => item.categoryTitle),
    weaknesses: categories.filter((item) => item.percent < 80).map((item) => ({ categoryTitle: item.categoryTitle, percent: item.percent })),
    recommendedStart: { knowledgeCode: interests.includes("数据") ? "data_literacy.charts_basics" : "machine_learning.image_classification" },
  };
}

function formatTime(value) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
