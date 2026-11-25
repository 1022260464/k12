import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Lock,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { agentsApi, knowledgeGraphApi, practiceApi, profileApi } from "../api/client.js";
import { AuthGateShowcase } from "../components/AuthGateShowcase.jsx";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { EXPERIENCE } from "../experience/experience.js";
import {
  challengePointsForRow,
  challengePointsTotal,
  filterPointsByStage,
  starsForPercent,
} from "../utils/lessonWhy.js";

const QUIZ_MIME = "application/vnd.k12.quiz.v1+json";
const MAX_WORLDS = 4;
const LEVELS_PER_WORLD = 4;
const FOCUS_KEY = "k12-challenge-focus";
// 关卡只放「小智能现场出题并当场判分」的知识点，与后端审定目录一致
// （k12-agent-runtime teaching_assistant/topics.py 的 TOPICS，共 20 个）。
// 目录外的知识点走动态讲解、出不了可判分的小测，不能做成关卡。
export const PLAYABLE_CODES = Object.freeze(new Set([
  "computer_vision.object_detection",
  "computing.algorithm_basics",
  "computing.loop_basics",
  "data_literacy.privacy_basics",
  "data_literacy.what_is_data",
  "generative_ai.agents_basics",
  "generative_ai.copyright_originality",
  "generative_ai.hallucination",
  "generative_ai.prompt_basics",
  "generative_ai.rag_basics",
  "generative_ai.responsible_use",
  "machine_learning.classification_regression",
  "machine_learning.data_bias",
  "machine_learning.embedding_intro",
  "machine_learning.features_labels",
  "machine_learning.image_classification",
  "machine_learning.neural_network_basics",
  "machine_learning.overfitting",
  "machine_learning.supervised_learning",
  "machine_learning.train_test_split",
]));
// 小学低年级主打猫课：图像分类有专用低龄题库，虽标注初中起步也放进闯关地图。
const LOWER_PRIMARY_EXTRA = Object.freeze(new Set(["machine_learning.image_classification"]));

/** 课堂/画像条跳闯关前调用：把知识点码交给闯关页，进页自动打开那一关。 */
export function requestChallengeFocus(code) {
  if (!code) return;
  try {
    sessionStorage.setItem(FOCUS_KEY, code);
  } catch {
    // 拿不到 sessionStorage 时降级为普通跳转
  }
}

/**
 * 知识闯关：把知识图谱里的本学段知识点做成关卡，
 * 每关由小智现场出一组小测，提交后当场判分并计入挑战积分与排行榜。
 * 关卡状态全部来自真实练习记录（掌握度），不另造数据。
 */
export function ChallengePage({
  session,
  requireLogin,
  navigate,
  experience = EXPERIENCE.TEEN,
  schoolStage,
}) {
  const primary = experience === EXPERIENCE.PRIMARY;
  const agentCode = primary ? "lower-primary-tutor" : "teaching-assistant";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [activeLevel, setActiveLevel] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.allSettled([knowledgeGraphApi.overview(), practiceApi.mastery(), profileApi.getLearningProfile()])
      .then(([graphResult, masteryResult, profileResult]) => {
        if (!active) return;
        if (graphResult.status !== "fulfilled") {
          setLoadError(graphResult.reason?.message || "知识图谱暂时读不到，稍后再试。");
        }
        setData({
          graph: graphResult.status === "fulfilled" ? graphResult.value : null,
          mastery: masteryResult.status === "fulfilled" ? masteryResult.value || [] : [],
          profile: profileResult.status === "fulfilled" ? profileResult.value : null,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const stage = data?.profile?.schoolStage || schoolStage || null;
  const masteryByCode = useMemo(() => {
    const map = new Map();
    (data?.mastery || []).forEach((row) => {
      if (row?.knowledgeCode) map.set(row.knowledgeCode, row);
    });
    return map;
  }, [data]);
  const worlds = useMemo(() => buildWorlds(data?.graph, stage, masteryByCode), [data, stage, masteryByCode]);
  const flatLevels = useMemo(() => worlds.flatMap((world) => world.levels), [worlds]);

  const totalPoints = challengePointsTotal(data?.mastery || []);
  const totalStars = flatLevels.reduce((sum, level) => sum + starsForPercent(masteryByCode.get(level.code)?.masteryPercent), 0);
  const clearedCount = flatLevels.filter((level) => (masteryByCode.get(level.code)?.masteryPercent || 0) > 0).length;

  const unlockState = useMemo(() => {
    const unlocked = new Set();
    flatLevels.forEach((level, index) => {
      if (index === 0 || unlocked.has(level.code)) {
        unlocked.add(level.code);
        return;
      }
      const previous = flatLevels[index - 1];
      const previousCleared = (masteryByCode.get(previous?.code)?.masteryPercent || 0) > 0;
      const practicedBefore = masteryByCode.has(level.code);
      if (previousCleared || practicedBefore) unlocked.add(level.code);
    });
    return unlocked;
  }, [flatLevels, masteryByCode]);

  const refreshMastery = useCallback(async () => {
    try {
      const rows = await practiceApi.mastery();
      setData((current) => (current ? { ...current, mastery: rows || [] } : current));
    } catch {
      // 刷新失败就沿用旧数据，不阻塞结果展示
    }
  }, []);

  const openLevel = useCallback(async (level) => {
    setActiveLevel(level);
    setQuiz(null);
    setGenError("");
    setGenerating(true);
    try {
      const run = await agentsApi.run(agentCode, {
        inputText: primary
          ? `我要闯「${level.title}」这一关。请给我一组有趣的小测题，答完马上判分。`
          : `请针对「${level.title}」给我出一组闯关小测，提交后当场判分并给出解析。`,
        sessionId: `challenge-${level.code}`,
        executionMode: "SYNC",
        context: {
          source: "user-web-challenge",
          stage: stage || undefined,
          preferDeterministic: true,
          requirePracticeArtifact: true,
          topicCode: level.code,
          topic: level.title,
          preferredInteraction: ["小测", "互动练习", "闯关挑战"],
        },
      });
      const artifact = (run.artifacts || []).find(
        (item) => (item?.mimeType === QUIZ_MIME || item?.kind === "GAME") && item?.payload?.questions?.length,
      );
      if (!artifact) {
        setGenError("这一关的题目没准备好。点「再试一次」；也可以去 AI 学习台让我先讲一遍这个知识点。");
        return;
      }
      setQuiz({
        runId: run.runId,
        title: artifact.payload?.title || level.title,
        instructions: artifact.payload?.instructions || "",
        questions: artifact.payload.questions,
      });
    } catch (requestError) {
      setGenError(requestError.message || "出题服务暂时没连上，稍后再试。");
    } finally {
      setGenerating(false);
    }
  }, [agentCode, primary, stage]);

  // 从课堂/画像条带焦点码进来时，直接打开那一关（未解锁就先落到地图）。
  useEffect(() => {
    if (loading || !flatLevels.length) return;
    let code = null;
    try {
      code = sessionStorage.getItem(FOCUS_KEY);
      if (code) sessionStorage.removeItem(FOCUS_KEY);
    } catch {
      // 隐私模式等拿不到 sessionStorage 时降级为普通进入
    }
    if (!code) return;
    const level = flatLevels.find((item) => item.code === code);
    if (level && unlockState.has(level.code) && !activeLevel) openLevel(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 数据就绪后消费一次焦点码即可
  }, [loading, flatLevels.length]);

  if (!session) {
    return (
      <div className="page inner-page challenge-page">
        <ChallengeHero experience={experience} />
        <AuthGateShowcase
          title="登录后开始知识闯关"
          description="每关由小智现场出题，提交后当场判分，成绩计入挑战积分和排行榜。"
          features={[
            { icon: Target, title: "一关一个知识点", text: "关卡按你的学段生成，学过就能闯。" },
            { icon: Zap, title: "闯关换积分", text: "答对得分，通关有奖励，积分上排行榜。" },
            { icon: Star, title: "错题有解析", text: "提交后马上看每道题的对错和讲解。" },
          ]}
          onLogin={() => requireLogin()}
        />
      </div>
    );
  }

  if (activeLevel) {
    return (
      <div className="page inner-page challenge-page">
        <div className="challenge-room">
          <header className="challenge-room-head">
            <button className="text-button" type="button" onClick={() => { setActiveLevel(null); setQuiz(null); setGenError(""); }}>
              <ArrowLeft size={16} />返回闯关地图
            </button>
            <div className="challenge-room-title">
              <span className="challenge-room-stage">挑战中</span>
              <h1>{activeLevel.title}</h1>
            </div>
            {quiz && <LevelStars percent={masteryByCode.get(activeLevel.code)?.masteryPercent} />}
          </header>
          {generating && (
            <div className="challenge-generating"><LoaderCircle size={22} />小智正在出题…</div>
          )}
          {genError && !generating && (
            <div className="challenge-gen-error" role="alert">
              <p>{genError}</p>
              <div>
                <button className="button secondary" type="button" onClick={() => openLevel(activeLevel)}><RotateCcw size={16} />再试一次</button>
                <button className="button primary" type="button" onClick={() => navigate("ai-studio")}>去 AI 学习台先学一遍</button>
              </div>
            </div>
          )}
          {quiz && !generating && (
            <ChallengeQuiz
              key={`${activeLevel.code}-${quiz.runId}`}
              quiz={quiz}
              level={activeLevel}
              onSubmitted={refreshMastery}
              onRetry={() => openLevel(activeLevel)}
              onNext={() => {
                const index = flatLevels.findIndex((item) => item.code === activeLevel.code);
                const next = flatLevels.slice(index + 1).find((item) => unlockState.has(item.code));
                if (next) openLevel(next);
                else { setActiveLevel(null); setQuiz(null); }
              }}
              hasNext={(() => {
                const index = flatLevels.findIndex((item) => item.code === activeLevel.code);
                return flatLevels.slice(index + 1).some((item) => unlockState.has(item.code));
              })()}
              onExit={() => { setActiveLevel(null); setQuiz(null); }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page inner-page challenge-page">
      <ChallengeHero experience={experience}>
        <div className="challenge-stats" aria-label="闯关成绩">
          <span><Zap size={16} />挑战积分 <strong>{totalPoints}</strong></span>
          <span><Star size={16} />星星 <strong>{totalStars}</strong></span>
          <span><Trophy size={16} />通关 <strong>{clearedCount}/{flatLevels.length}</strong></span>
        </div>
      </ChallengeHero>

      {loading && <div className="loading-state"><LoaderCircle size={22} />正在准备闯关地图</div>}
      {loadError && !loading && <p className="page-error" role="alert">{loadError}</p>}

      {!loading && !loadError && worlds.length === 0 && (
        <section className="empty-state">
          <h2>这一学段的关卡还在搭建</h2>
          <p>先去 AI 学习台学几个知识点，闯关地图会跟着你的学段出现。</p>
          <button className="button primary" type="button" onClick={() => navigate("ai-studio")}>去 AI 学习台</button>
        </section>
      )}

      {!loading && worlds.map((world) => (
        <section className="challenge-world" key={world.id} aria-label={world.title}>
          <header className="challenge-world-head">
            <span className="challenge-world-badge"><GamepadIcon size={16} /></span>
            <div>
              <h2>{world.title}</h2>
              <small>{world.levels.length} 关 · 通关拿星星，答对换积分</small>
            </div>
          </header>
          <ol className="challenge-levels">
            {world.levels.map((level) => {
              const row = masteryByCode.get(level.code);
              const percent = row?.masteryPercent;
              const stars = starsForPercent(percent);
              const unlocked = unlockState.has(level.code);
              return (
                <li className={`challenge-level ${unlocked ? "unlocked" : "locked"} ${stars ? "cleared" : ""}`} key={level.code}>
                  <div className="challenge-level-stars" aria-label={stars ? `${stars} 星` : "未通关"}>
                    {[1, 2, 3].map((n) => (
                      <Star key={n} size={14} className={n <= stars ? "on" : ""} />
                    ))}
                  </div>
                  <strong>{level.title}</strong>
                  <small>{unlocked ? (stars ? `本关积分 ${challengePointsForRow(row)}` : "可挑战") : "通过上一关解锁"}</small>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={!unlocked}
                    onClick={() => (unlocked ? openLevel(level) : undefined)}
                  >
                    {unlocked ? (stars ? <><RotateCcw size={15} />再挑战</> : <><Sparkles size={15} />开始挑战</>) : <><Lock size={15} />未解锁</>}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {!loading && worlds.length > 0 && (
        <p className="challenge-note">
          挑战积分 = 各知识点掌握度 + 通关奖励（3★ +15 / 2★ +10 / 1★ +5），已计入排行榜；
          关卡与成绩全部来自你的真实练习记录。
          <button className="text-button" type="button" onClick={() => navigate("leaderboard")}>看排行榜<ArrowRight size={14} /></button>
        </p>
      )}
    </div>
  );
}

function ChallengeQuiz({ quiz, level, onSubmitted, onRetry, onNext, hasNext, onExit }) {
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const questions = quiz.questions;
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const hintCount = Object.values(hints).reduce((sum, value) => sum + value, 0);
  const wrongQuestions = result
    ? questions.filter((question) => answers[question.id] !== question.correctOptionId)
    : [];

  async function submit() {
    if (saving || answeredCount !== questions.length) return;
    setSaving(true);
    setError("");
    try {
      const attempt = await practiceApi.submit({
        runId: quiz.runId,
        hintCount: Math.min(20, hintCount),
        answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
      });
      setResult(attempt);
      onSubmitted?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const percent = result ? Math.round((result.score / Math.max(1, result.maxScore)) * 100) : 0;
  const stars = starsForPercent(percent);

  return (
    <section className="challenge-quiz" aria-label={quiz.title}>
      {quiz.instructions && <p className="challenge-quiz-instructions">{quiz.instructions}</p>}
      {questions.map((question, questionIndex) => {
        const selected = answers[question.id];
        const correct = result && selected === question.correctOptionId;
        const hinted = hints[question.id];
        return (
          <fieldset key={question.id} disabled={Boolean(result)}>
            <legend>{questionIndex + 1}. {question.prompt}</legend>
            {question.visual?.value && (
              <div className={`challenge-quiz-visual ${question.visual.kind === "image" ? "image" : "emoji"}`} role="img" aria-label={question.visual.alt || "题目插图"}>
                {question.visual.kind === "image" ? <img src={question.visual.value} alt={question.visual.alt || "题目插图"} /> : question.visual.value}
              </div>
            )}
            <div className="challenge-quiz-options">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className={
                    result && option.id === question.correctOptionId
                      ? "correct"
                      : result && selected === option.id
                        ? "wrong"
                        : selected === option.id
                          ? "picked"
                          : ""
                  }
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={selected === option.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                  />
                  <span>{option.text}</span>
                  {result && option.id === question.correctOptionId && <CheckCircle2 size={15} />}
                </label>
              ))}
            </div>
            {!result && (
              <button className="challenge-hint-button" type="button" disabled={hinted} onClick={() => setHints((current) => ({ ...current, [question.id]: 1 }))}>
                <Sparkles size={13} />{hinted ? "提示已打开" : "要个提示"}
              </button>
            )}
            {hinted && !result && <p className="challenge-hint-text">{question.hint || `提示：想想「${level.title}」的关键点。`}</p>}
            {result && (
              <p className={correct ? "challenge-explain correct" : "challenge-explain wrong"}>
                <strong>{correct ? "答对了" : "答错了"}</strong>
                {question.explanation || `正确答案是这道题里带 ✓ 的选项。`}
              </p>
            )}
          </fieldset>
        );
      })}

      {!result ? (
        <button className="button primary challenge-submit" type="button" disabled={saving || answeredCount !== questions.length} onClick={submit}>
          {saving ? <LoaderCircle size={16} /> : <Zap size={16} />}
          {saving ? "正在判分…" : answeredCount === questions.length ? "提交判分" : `还剩 ${questions.length - answeredCount} 题没答`}
        </button>
      ) : (
        <div className="challenge-result">
          <div className="challenge-result-main">
            <div className="challenge-result-stars" aria-label={`${stars} 星`}>
              {[1, 2, 3].map((n) => <Star key={n} size={26} className={n <= stars ? "on" : ""} />)}
            </div>
            <strong>{result.score}/{result.maxScore} 分</strong>
            <span>答对 {result.correctCount}/{result.totalQuestions} 题{result.badgeName ? ` · 徽章「${result.badgeName}」` : ""}</span>
            <em>成绩已计入挑战积分和排行榜{wrongQuestions.length ? `，重点看下面的错题解析` : "，全对真棒"}</em>
          </div>
          <div className="challenge-result-actions">
            <button className="button secondary" type="button" onClick={onRetry}><RotateCcw size={16} />再挑战一次</button>
            {hasNext && <button className="button primary" type="button" onClick={onNext}>下一关<ArrowRight size={16} /></button>}
            <button className="button secondary" type="button" onClick={onExit}>返回闯关地图</button>
          </div>
        </div>
      )}
      {error && <p className="challenge-explain wrong" role="alert">{error}</p>}
      {!result && <footer className="challenge-quiz-foot">提交后当场判分，成绩会计入挑战积分与排行榜，不计入作业或考试成绩。</footer>}
      <button className="text-button challenge-close" type="button" onClick={onExit}><X size={14} />收起这一关</button>
    </section>
  );
}

function LevelStars({ percent }) {
  const stars = starsForPercent(percent);
  return (
    <div className="challenge-level-stars big" aria-label={stars ? `${stars} 星` : "未通关"}>
      {[1, 2, 3].map((n) => <Star key={n} size={18} className={n <= stars ? "on" : ""} />)}
    </div>
  );
}

function ChallengeHero({ experience, children }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  return (
    <ExperiencePageHeader
      experience={experience}
      eyebrow={primary ? "闯关乐园" : "知识闯关"}
      title={primary ? "闯一关，拿一颗星" : "把学过的知识闯成关"}
      description={primary ? "每闯一关，小智出几道小题；答对拿星星，星星换积分！" : "每关一个知识点，小智现场出题、当场判分；成绩计入挑战积分与排行榜。"}
      imageKey="tasks"
    >
      {children}
    </ExperiencePageHeader>
  );
}

function GamepadIcon({ size = 16 }) {
  return <Target size={size} />;
}

function buildWorlds(graph, stage, masteryByCode) {
  const points = Array.isArray(graph?.points) ? graph.points : [];
  if (!points.length) return [];
  // 先限可玩目录，再做学段过滤；练过的点（含目录外起步学段的猫课点）永远保留。
  const playable = points.filter((point) => PLAYABLE_CODES.has(point.code));
  const keptCodes = new Set(filterPointsByStage(playable, stage).map((point) => point.code));
  if (stage === "PRIMARY_LOWER") LOWER_PRIMARY_EXTRA.forEach((code) => keptCodes.add(code));
  (masteryByCode || new Map()).forEach((_row, code) => keptCodes.add(code));
  const kept = playable.filter((point) => keptCodes.has(point.code));
  if (!kept.length) return [];
  const byCategory = new Map();
  kept.forEach((point) => {
    const key = point.categoryCode || "other";
    if (!byCategory.has(key)) {
      byCategory.set(key, { id: key, title: point.categoryTitle || "综合挑战", points: [] });
    }
    byCategory.get(key).points.push(point);
  });
  return [...byCategory.values()]
    .map((world) => ({
      ...world,
      minDifficulty: Math.min(...world.points.map((point) => point.difficulty || 3)),
    }))
    .sort((a, b) => a.minDifficulty - b.minDifficulty || a.title.localeCompare(b.title))
    .slice(0, MAX_WORLDS)
    .map((world) => ({
      ...world,
      levels: world.points
        .slice()
        .sort((a, b) => (a.difficulty || 3) - (b.difficulty || 3) || String(a.code).localeCompare(String(b.code)))
        .slice(0, LEVELS_PER_WORLD),
    }));
}
