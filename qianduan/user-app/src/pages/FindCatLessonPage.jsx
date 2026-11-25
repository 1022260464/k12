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
import { profileApi, speechApi } from "../api/client.js";
import {
  findCatPictureBook,
  findCatProgress,
  findCatQuiz,
  findCatSequence,
  FIND_CAT_KNOWLEDGE_CODE,
} from "../data/findCatLesson.js";

const STAGE_LABELS = {
  PRIMARY_LOWER: "小学低年级",
  PRIMARY_UPPER: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

export function FindCatLessonPage({ session, requireLogin, navigate, onContinue }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(session));
  const [stageSaving, setStageSaving] = useState(false);
  const [step, setStep] = useState("intro");
  const [pageIndex, setPageIndex] = useState(0);
  const [orderedIds, setOrderedIds] = useState([]);
  const [sequenceError, setSequenceError] = useState("");
  const [answers, setAnswers] = useState({});
  const [hintedQuestions, setHintedQuestions] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [speechState, setSpeechState] = useState("");
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

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

  const page = findCatPictureBook.pages[pageIndex];
  const allAnswered = findCatQuiz.questions.every((question) => answers[question.id]);
  const score = result?.score ?? 0;
  const progress = findCatProgress(step, pageIndex);

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
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeechState("");
  }

  async function readAloud(text) {
    stopSpeech();
    setSpeechState("正在准备云端语音…");
    try {
      const audioResult = await speechApi.synthesize(String(text || "").trim());
      const url = URL.createObjectURL(audioResult.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => setSpeechState("小智正在朗读");
      audio.onended = stopSpeech;
      await audio.play();
    } catch {
      if (!("speechSynthesis" in window)) {
        setSpeechState("语音暂时不可用，请阅读屏幕文字");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(String(text || ""));
      utterance.lang = "zh-CN";
      utterance.rate = 0.9;
      utterance.onend = () => setSpeechState("");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeechState("已切换浏览器朗读");
    }
  }

  function chooseSequenceStep(id) {
    if (orderedIds.includes(id)) return;
    const expected = findCatSequence.steps[orderedIds.length]?.id;
    if (id !== expected) {
      setSequenceError(findCatSequence.hint);
      return;
    }
    setSequenceError("");
    const next = [...orderedIds, id];
    setOrderedIds(next);
    if (next.length === findCatSequence.steps.length) {
      window.setTimeout(() => setStep("game"), 450);
    }
  }

  function submitGame() {
    if (!allAnswered) return;
    const correctCount = findCatQuiz.questions.filter((question) => answers[question.id] === question.answer).length;
    setResult({
      score: correctCount * 25,
      maxScore: 100,
      correctCount,
      totalQuestions: findCatQuiz.questions.length,
      badgeName: correctCount === findCatQuiz.questions.length ? "捉迷藏神探" : "捉迷藏克星",
    });
    setStep("reward");
  }

  function restart() {
    setOrderedIds([]);
    setSequenceError("");
    setAnswers({});
    setHintedQuestions({});
    setResult(null);
    setPageIndex(0);
    setStep("intro");
  }

  if (!session) {
    return (
      <LessonShell navigate={navigate} progress={0}>
        <section className="cat-lesson-gate">
          <BookOpen size={34} />
          <h1>登录后开始找小猫课</h1>
          <p>第二课不需要联网生成，登录后就能开始捉迷藏挑战。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>登录并开始</button>
        </section>
      </LessonShell>
    );
  }

  if (profileLoading) {
    return <LessonShell navigate={navigate} progress={0}><div className="loading-state"><LoaderCircle className="spin" size={22} />正在读取学习档案</div></LessonShell>;
  }

  if (profile?.schoolStage !== "PRIMARY_LOWER") {
    return (
      <LessonShell navigate={navigate} progress={0}>
        <section className="cat-stage-picker">
          <p className="eyebrow">第一步 · 选择适合的学段</p>
          <h1>这也是一节小学低年级 AI 课</h1>
          <p>当前学习档案：{STAGE_LABELS[profile?.schoolStage] || "尚未选择"}。切换后就可以开始“找到小猫在哪里”。</p>
          <div className="stage-choice-row" aria-label="学段选择">
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <button className={value === "PRIMARY_LOWER" ? "active" : ""} type="button" key={value} disabled={value !== "PRIMARY_LOWER"}>
                <strong>{label}</strong><span>{value === "PRIMARY_LOWER" ? "本课入口" : "可在个人中心选择"}</span>
              </button>
            ))}
          </div>
          {error && <p className="page-error" role="alert">{error}</p>}
          <button className="button primary" type="button" disabled={stageSaving} onClick={chooseLowerPrimary}>
            {stageSaving ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
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
            <p className="eyebrow">AI 小侦探 · 第 2 课 · 8 分钟任务</p>
            <h1>找到小猫在哪里</h1>
            <p>上一课我们教会了 AI 认出小猫；这一课要让 AI 说得出：小猫到底在图片的哪个位置。</p>
            <div className="cat-goal-list"><span>1 读绘本</span><span>2 排程序</span><span>3 找答案</span><span>4 拿徽章</span></div>
            <button className="button primary" type="button" onClick={() => setStep("book")}><BookOpen size={18} />开始读绘本</button>
          </div>
          <img src="/assets/experience/primary/books.webp" alt="小侦探翻开第二课的绘本" />
        </section>
      )}

      {step === "book" && (
        <section className="picture-book" aria-labelledby="find-cat-book-title">
          <header>
            <div><p className="eyebrow">互动绘本 · {pageIndex + 1}/{findCatPictureBook.pages.length}</p><h1 id="find-cat-book-title">{findCatPictureBook.title}</h1></div>
            <div className="speech-controls">
              <button className="button secondary" type="button" onClick={() => readAloud(page.narration)}><Volume2 size={17} />朗读这一页</button>
              <button className="icon-button" type="button" title="停止朗读" onClick={stopSpeech}><Square size={16} /></button>
            </div>
          </header>
          {speechState && <p className="speech-status" role="status"><Headphones size={15} />{speechState}</p>}
          <div className="picture-book-spread">
            <div className="picture-book-art"><img src={page.image} alt={page.alt} /></div>
            <div className="picture-book-copy"><span>第 {page.pageNo} 页</span><h2>{page.title}</h2><p>{page.narration}</p><aside>{page.prompt}</aside></div>
          </div>
          <footer>
            <button className="button secondary" type="button" disabled={pageIndex === 0} onClick={() => { stopSpeech(); setPageIndex((value) => value - 1); }}><ArrowLeft size={17} />上一页</button>
            {pageIndex < findCatPictureBook.pages.length - 1 ? (
              <button className="button primary" type="button" onClick={() => { stopSpeech(); setPageIndex((value) => value + 1); }}>下一页<ArrowRight size={17} /></button>
            ) : (
              <button className="button primary" type="button" onClick={() => { stopSpeech(); setStep("code"); }}>教电脑找位置<ArrowRight size={17} /></button>
            )}
          </footer>
        </section>
      )}

      {step === "code" && (
        <section className="find-cat-sequence">
          <header><p className="eyebrow">编程小任务 · 教电脑找猫</p><h1>{findCatSequence.title}</h1><p>{findCatSequence.intro}</p></header>
          <div className="find-cat-sequence-track" aria-label="已经排好的步骤">
            {findCatSequence.steps.map((sequenceStep, index) => {
              const placedId = orderedIds[index];
              const placed = findCatSequence.steps.find((item) => item.id === placedId);
              return <span className={placed ? "filled" : ""} key={sequenceStep.id}><b>{index + 1}</b>{placed ? `${placed.emoji} ${placed.label}` : "等待选择"}</span>;
            })}
          </div>
          <div className="find-cat-sequence-options">
            {findCatSequence.shuffledIds.map((id) => {
              const sequenceStep = findCatSequence.steps.find((item) => item.id === id);
              return <button type="button" disabled={orderedIds.includes(id)} key={id} onClick={() => chooseSequenceStep(id)}><span>{sequenceStep.emoji}</span><strong>{sequenceStep.label}</strong></button>;
            })}
          </div>
          {sequenceError && <p className="find-cat-hint" role="status">{sequenceError}</p>}
          {orderedIds.length === findCatSequence.steps.length && <p className="find-cat-success"><CheckCircle2 size={17} />{findCatSequence.successText}</p>}
        </section>
      )}

      {step === "game" && (
        <section className="cat-classification-game">
          <header><p className="eyebrow">找小猫游戏</p><h1>选出让 AI 指出位置的正确做法</h1><p>{findCatQuiz.instructions}</p></header>
          <div className="classification-questions">
            {findCatQuiz.questions.map((question, index) => (
              <fieldset key={question.id}>
                <legend>第 {index + 1} 关 · {question.prompt}</legend>
                <div className="classification-visual scene-visual" role="img" aria-label={question.prompt}>{question.visual}</div>
                <div className="classification-options">
                  {question.options.map((option) => (
                    <label className={answers[question.id] === option.id ? "selected" : ""} key={option.id}>
                      <input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
                <button className="classification-hint-button" type="button" aria-expanded={Boolean(hintedQuestions[question.id])} onClick={() => setHintedQuestions((current) => ({ ...current, [question.id]: true }))}>
                  {hintedQuestions[question.id] ? "提示已打开" : "需要一个小提示"}
                </button>
                {hintedQuestions[question.id] && <p className="classification-hint" role="status">{question.hint}</p>}
              </fieldset>
            ))}
          </div>
          <button className="button primary cat-submit-game" type="button" disabled={!allAnswered} onClick={submitGame}><CheckCircle2 size={17} />提交答案</button>
        </section>
      )}

      {step === "reward" && result && (
        <section className="cat-reward">
          <div className="cat-badge"><Medal size={54} /><span>{result.badgeName}</span></div>
          <div>
            <p className="eyebrow">第二课完成</p>
            <h1>{score === 100 ? "全对！徽章到手！" : "徽章到手！"}</h1>
            <p>本课闯关判分：{result.score}/{result.maxScore} 分 · 答对 {result.correctCount}/{result.totalQuestions} 题</p>
            <div className="mastery-card"><span>找位置（目标检测）掌握度</span><strong>{score}%</strong><div><i style={{ width: `${score}%` }} /></div></div>
            <aside className="next-lesson-card"><small>下一站</small><strong>去问问小智：AI 还能找到什么？</strong><p>把这一课学到的“画框找位置”讲给小智听，看看它还会带你去探索什么。</p></aside>
            <div className="reward-actions">
              <button className="button secondary" type="button" onClick={restart}><RotateCcw size={17} />再玩一次</button>
              <button className="button secondary" type="button" onClick={() => navigate("cat-lesson")}><BookOpen size={17} />复习上一课</button>
              <button className="button primary" type="button" onClick={() => onContinue?.({ code: FIND_CAT_KNOWLEDGE_CODE, title: "AI 怎样在图片里找到物体" })}>回到 AI 学习台继续<ArrowRight size={17} /></button>
            </div>
          </div>
        </section>
      )}
    </LessonShell>
  );
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
