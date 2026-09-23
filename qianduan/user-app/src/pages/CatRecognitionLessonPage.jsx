import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Headphones,
  LoaderCircle,
  Medal,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  agentsApi,
  knowledgeGraphApi,
  practiceApi,
  profileApi,
  speechApi,
  pictureBooksApi,
} from "../api/client.js";
import {
  CAT_KNOWLEDGE_CODE,
  catPictureBook,
  fallbackRecommendation,
  lessonProgress,
} from "../data/catRecognitionLesson.js";
import { MarkdownContent } from "../components/MarkdownContent.jsx";
import { normalizePictureBook } from "../data/pictureBookFallback.js";

const QUIZ_MIME = "application/vnd.k12.quiz.v1+json";
const STAGE_LABELS = {
  PRIMARY_LOWER: "小学低年级",
  PRIMARY_UPPER: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

export function CatRecognitionLessonPage({ session, requireLogin, navigate, onContinue }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(session));
  const [stageSaving, setStageSaving] = useState(false);
  const [step, setStep] = useState("intro");
  const [pageIndex, setPageIndex] = useState(0);
  const [run, setRun] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [hintedQuestions, setHintedQuestions] = useState({});
  const [result, setResult] = useState(null);
  const [mastery, setMastery] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [speechState, setSpeechState] = useState("");
  const [pictureBook, setPictureBook] = useState(catPictureBook);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const gameStartedAtRef = useRef(null);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }
    let active = true;
    setProfileLoading(true);
    profileApi.getLearningProfile()
      .then((data) => { if (active) setProfile(data); })
      .catch((requestError) => {
        if (active && requestError.status !== 404) setError(requestError.message);
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => () => stopSpeech(), []);

  useEffect(() => {
    let active = true;
    pictureBooksApi.getPublished("ai-recognizes-cats")
      .then((value) => {
        const normalized = normalizePictureBook(value);
        if (active && normalized?.pages?.length) {
          setPictureBook({ ...normalized, pages: normalized.pages.map((item) => ({
            ...item, image: item.imageUrl, alt: item.altText,
          })) });
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const page = pictureBook.pages[pageIndex];
  const progress = lessonProgress(step, pageIndex);
  const allAnswered = quiz?.questions?.every((question) => answers[question.id]);
  const masteryPercent = mastery?.masteryPercent
    ?? (result ? Math.round((result.score / result.maxScore) * 100) : 0);
  const currentSpeechText = step === "book" ? page.narration : run?.outputText;

  async function chooseLowerPrimary() {
    setStageSaving(true);
    setError("");
    try {
      const updated = await profileApi.updateLearningProfile({
        schoolStage: "PRIMARY_LOWER",
        grade: profile?.schoolStage === "PRIMARY_LOWER" ? profile.grade : 2,
        textbook: profile?.textbook || null,
        interests: Array.isArray(profile?.interests) ? profile.interests : [],
      });
      setProfile(updated);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStageSaving(false);
    }
  }

  function stopSpeech() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeechState("");
  }

  async function readAloud(text) {
    const speechText = toSpeechText(text);
    if (!speechText) return;
    stopSpeech();
    setSpeechState("正在准备百炼云语音…");
    try {
      const audioResult = await speechApi.synthesize(speechText);
      const url = URL.createObjectURL(audioResult.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => setSpeechState("百炼云语音正在朗读");
      audio.onended = () => stopSpeech();
      audio.onerror = () => browserReadAloud(speechText, "云端音频播放失败");
      await audio.play();
    } catch (requestError) {
      browserReadAloud(speechText, requestError?.message);
    }
  }

  function browserReadAloud(text, cloudError) {
    if (!("speechSynthesis" in window)) {
      setSpeechState("语音暂时不可用，请阅读屏幕文字");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeechState("");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeechState(cloudError
      ? `百炼云语音未连接（${cloudError}），已切换浏览器朗读`
      : "已切换浏览器朗读");
  }

  async function prepareActivity() {
    if (run && quiz) {
      setStep("explain");
      return;
    }
    setLoadingActivity(true);
    setError("");
    stopSpeech();
    try {
      const nextRun = await agentsApi.run("lower-primary-tutor", {
        inputText: "请再演示图像分类，并准备《AI 为什么能认出小猫》的图片分类游戏。",
        sessionId: "cat-recognition-guided-lesson",
        executionMode: "SYNC",
        context: {
          preferDeterministic: true,
          requirePracticeArtifact: true,
          topicCode: CAT_KNOWLEDGE_CODE,
          topic: "图像分类",
          preferredInteraction: ["互动绘本", "图片选择", "短句讲解"],
          lessonMode: "guided-picture-book",
        },
      });
      const quizArtifact = nextRun?.artifacts?.find((item) => item.mimeType === QUIZ_MIME);
      if (!quizArtifact?.payload?.questions?.length) {
        throw new Error("小智暂时没有准备好图片游戏，请稍后再试");
      }
      setRun(nextRun);
      setQuiz(quizArtifact.payload);
      setStep("explain");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingActivity(false);
    }
  }

  async function submitGame() {
    if (!allAnswered || !run?.runId) return;
    setSubmitting(true);
    setError("");
    try {
      const attempt = await practiceApi.submit({
        runId: run.runId,
        hintCount: Object.keys(hintedQuestions).length,
        durationMs: gameStartedAtRef.current
          ? Math.min(3600000, Math.max(0, Date.now() - gameStartedAtRef.current))
          : 0,
        answers: quiz.questions.map((question) => ({
          questionId: question.id,
          optionId: answers[question.id],
        })),
      });
      const masteryList = await practiceApi.mastery().catch(() => []);
      const currentMastery = masteryList.find((item) => item.knowledgeCode === CAT_KNOWLEDGE_CODE) || null;
      const masteryHints = masteryList
        .filter((item) => item.knowledgeCode)
        .map((item) => ({ knowledgeCode: item.knowledgeCode, masteryPercent: item.masteryPercent }));
      const nextTopics = await knowledgeGraphApi.recommendNext({
        focusCode: CAT_KNOWLEDGE_CODE,
        mastery: masteryHints,
      }).catch(() => []);
      const percent = currentMastery?.masteryPercent
        ?? Math.round((attempt.score / attempt.maxScore) * 100);
      setResult(attempt);
      setMastery(currentMastery);
      setRecommendation(nextTopics[0] || fallbackRecommendation(percent));
      setStep("reward");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function restartGame() {
    setAnswers({});
    setHintedQuestions({});
    setResult(null);
    setRecommendation(null);
    gameStartedAtRef.current = Date.now();
    setStep("game");
  }

  function beginGame() {
    stopSpeech();
    setHintedQuestions({});
    gameStartedAtRef.current = Date.now();
    setStep("game");
  }

  if (!session) {
    return (
      <LessonShell navigate={navigate} progress={0}>
        <section className="cat-lesson-gate">
          <BookOpen size={34} />
          <h1>登录后开始小猫侦探课</h1>
          <p>登录后才能保存游戏判分、掌握度和徽章。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>登录并开始</button>
        </section>
      </LessonShell>
    );
  }

  if (profileLoading) {
    return <LessonShell navigate={navigate} progress={0}><div className="loading-state"><LoaderCircle size={22} />正在读取学习档案</div></LessonShell>;
  }

  if (profile?.schoolStage !== "PRIMARY_LOWER") {
    return (
      <LessonShell navigate={navigate} progress={0}>
        <section className="cat-stage-picker">
          <p className="eyebrow">第一步 · 选择适合的学段</p>
          <h1>这是一节小学低年级 AI 课</h1>
          <p>当前学习档案：{STAGE_LABELS[profile?.schoolStage] || "尚未选择"}。切换后，讲解会使用更短的句子、绘本和图片游戏。</p>
          <div className="stage-choice-row" aria-label="学段选择">
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <button className={value === "PRIMARY_LOWER" ? "active" : ""} type="button" key={value} disabled={value !== "PRIMARY_LOWER"}>
                <strong>{label}</strong><span>{value === "PRIMARY_LOWER" ? "本课入口" : "可在个人中心选择"}</span>
              </button>
            ))}
          </div>
          {error && <p className="page-error" role="alert">{error}</p>}
          <button className="button primary" type="button" disabled={stageSaving} onClick={chooseLowerPrimary}>
            {stageSaving ? <LoaderCircle size={17} /> : <Sparkles size={17} />}
            {stageSaving ? "正在保存学段…" : "设为小学低年级并开始"}
          </button>
        </section>
      </LessonShell>
    );
  }

  return (
    <LessonShell navigate={navigate} progress={progress}>
      {error && <p className="page-error cat-lesson-error" role="alert">{error}</p>}

      {step === "intro" && (
        <section className="cat-lesson-intro">
          <div>
            <p className="eyebrow">AI 小侦探 · 8 分钟任务</p>
            <h1>AI 为什么能认出小猫</h1>
            <p>今天完成三件事：听绘本、玩图片分类、发现 AI 也会猜错。</p>
            <div className="cat-goal-list"><span>1 听故事</span><span>2 分图片</span><span>3 拿徽章</span></div>
            <button className="button primary" type="button" onClick={() => setStep("book")}><BookOpen size={18} />开始读绘本</button>
          </div>
          <img src="/assets/experience/primary/student-reading.webp" alt="小学生和小智一起读绘本" />
        </section>
      )}

      {step === "book" && (
        <section className="picture-book" aria-labelledby="picture-book-title">
          <header>
            <div><p className="eyebrow">互动绘本 · {pageIndex + 1}/{pictureBook.pages.length}</p><h1 id="picture-book-title">{pictureBook.title}</h1></div>
            <div className="speech-controls">
              <button className="button secondary" type="button" onClick={() => readAloud(page.narration)}><Volume2 size={17} />朗读这一页</button>
              <button className="icon-button" type="button" title="停止朗读" onClick={stopSpeech}><Square size={16} /></button>
            </div>
          </header>
          {speechState && <p className="speech-status" role="status"><Headphones size={15} />{speechState}</p>}
          <div className="picture-book-spread">
            <div className="picture-book-art"><img src={page.image} alt={page.alt} /></div>
            <div className="picture-book-copy">
              <span>第 {page.pageNo} 页</span><h2>{page.title}</h2><p>{page.narration}</p><aside>{page.prompt}</aside>
            </div>
          </div>
          <footer>
            <button className="button secondary" type="button" disabled={pageIndex === 0} onClick={() => { stopSpeech(); setPageIndex((value) => value - 1); }}><ArrowLeft size={17} />上一页</button>
            {pageIndex < pictureBook.pages.length - 1 ? (
              <button className="button primary" type="button" onClick={() => { stopSpeech(); setPageIndex((value) => value + 1); }}>下一页<ArrowRight size={17} /></button>
            ) : (
              <button className="button primary" type="button" disabled={loadingActivity} onClick={prepareActivity}>
                {loadingActivity ? <LoaderCircle size={17} /> : <Sparkles size={17} />}{loadingActivity ? "小智正在准备…" : "听小智讲一讲"}
              </button>
            )}
          </footer>
        </section>
      )}

      {step === "explain" && run && (
        <section className="cat-explanation">
          <div className="cat-teacher-avatar"><img src="/assets/experience/primary/mascot-wave.webp" alt="小智" /></div>
          <div>
            <p className="eyebrow">小智的文字讲解</p>
            <h1>图片、标签和线索</h1>
            <MarkdownContent className="cat-explanation-text">{run.outputText}</MarkdownContent>
            <div className="speech-controls">
              <button className="button secondary" type="button" onClick={() => readAloud(run.outputText)}><Volume2 size={17} />百炼云语音朗读</button>
              <button className="button primary" type="button" onClick={beginGame}>开始图片分类<ArrowRight size={17} /></button>
            </div>
            {speechState && <p className="speech-status" role="status"><Headphones size={15} />{speechState}</p>}
          </div>
        </section>
      )}

      {step === "game" && quiz && (
        <section className="cat-classification-game">
          <header><p className="eyebrow">图片分类游戏</p><h1>把图片卡放进正确的标签盒</h1><p>{quiz.instructions}</p></header>
          <div className="classification-questions">
            {quiz.questions.map((question, index) => (
              <fieldset key={question.id}>
                <legend>第 {index + 1} 关 · {question.prompt}</legend>
                {question.visual && <div className="classification-visual" role="img" aria-label={question.visual.alt}>{question.visual.value}</div>}
                <div className="classification-options">
                  {question.options.map((option) => (
                    <label className={answers[question.id] === option.id ? "selected" : ""} key={option.id}>
                      <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
                <button
                  className="classification-hint-button"
                  type="button"
                  aria-expanded={Boolean(hintedQuestions[question.id])}
                  onClick={() => setHintedQuestions((current) => ({ ...current, [question.id]: true }))}
                >
                  {hintedQuestions[question.id] ? "提示已打开" : "需要一个小提示"}
                </button>
                {hintedQuestions[question.id] && <p className="classification-hint" role="status">{question.hint || "先观察图片里的主要线索，再对照标签。"}</p>}
              </fieldset>
            ))}
          </div>
          <button className="button primary cat-submit-game" type="button" disabled={!allAnswered || submitting} onClick={submitGame}>
            {submitting ? <LoaderCircle size={17} /> : <CheckCircle2 size={17} />}{submitting ? "服务端正在判分…" : "提交给小智判分"}
          </button>
        </section>
      )}

      {step === "reward" && result && (
        <section className="cat-reward">
          <div className="cat-badge"><Medal size={54} /><span>{result.badgeName || "图片分类小侦探"}</span></div>
          <div>
            <p className="eyebrow">学习记录已更新</p>
            <h1>{result.newlyEarned ? "新徽章到手！" : "这枚徽章已经属于你"}</h1>
            <p>服务端判分：{result.score}/{result.maxScore} 分 · 答对 {result.correctCount}/{result.totalQuestions} 题</p>
            <div className="mastery-card"><span>图像分类掌握度</span><strong>{masteryPercent}%</strong><div><i style={{ width: `${masteryPercent}%` }} /></div></div>
            {recommendation && (
              <aside className="next-lesson-card"><small>推荐下一节</small><strong>{recommendation.title}</strong><p>{recommendation.reason}</p></aside>
            )}
            <div className="reward-actions">
              <button className="button secondary" type="button" onClick={restartGame}><RotateCcw size={17} />再玩一次</button>
              <button className="button primary" type="button" onClick={() => onContinue?.(recommendation)}>{masteryPercent < 60 ? "跟小智再复习" : "学习下一节"}<ArrowRight size={17} /></button>
            </div>
          </div>
        </section>
      )}
    </LessonShell>
  );
}

function toSpeechText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function LessonShell({ navigate, progress, children }) {
  return (
    <div className="page inner-page cat-lesson-page">
      <header className="cat-lesson-header">
        <button className="text-button" type="button" onClick={() => navigate("home")}><ArrowLeft size={16} />回到今天学什么</button>
        <div className="cat-progress" aria-label={`课程进度 ${progress}%`}><span><i style={{ width: `${progress}%` }} /></span><strong>{progress}%</strong></div>
      </header>
      {children}
    </div>
  );
}
