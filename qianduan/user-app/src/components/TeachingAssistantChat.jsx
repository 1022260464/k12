import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Code2,
  ExternalLink,
  Lightbulb,
  LoaderCircle,
  MessageSquarePlus,
  Mic,
  Send,
  Square,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { agentsApi, practiceApi, profileApi, speechApi, teachingResourcesApi } from "../api/client.js";
import { blobToBase64, createVoiceRecorder } from "../utils/voiceInput.js";
import { BubbleSortAnimation } from "./BubbleSortAnimation.jsx";
import { CoursewarePlayer, isCoursewareArtifact } from "./CoursewarePlayer.jsx";
import { MarkdownContent } from "./MarkdownContent.jsx";
import { TeachingSteps } from "./TeachingSteps.jsx";
import { topicCodeForId } from "../data/teachingTopics.js";
import { primaryEmojiFor, primaryPictureFor } from "../data/primaryChatPictures.js";
import { PLAYABLE_CODES } from "../pages/ChallengePage.jsx";

export { TEACHING_TOPICS, TOPIC_CATEGORIES, topicsByCategory } from "../data/teachingTopics.js";

const ASSISTANT_ICON = "/assets/ai-assistant-doodle.png";

const stageCodes = {
  PRIMARY_LOWER: "lower_primary",
  PRIMARY_UPPER: "upper_primary",
  JUNIOR_HIGH: "middle_school",
  SENIOR_HIGH: "high_school",
};

// 需求 §5.2：所有 AI 生成状态都要有阶段提示，不能只靠颜色/转圈。
const PENDING_STAGES = [
  { emoji: "🧠", label: "理解任务" },
  { emoji: "🔎", label: "查找资料" },
  { emoji: "🧩", label: "组织课堂" },
  { emoji: "✨", label: "生成内容" },
];
// 各阶段切换的时间阈值（毫秒）：回答越久，说明进入越深的生成阶段。
const PENDING_STAGE_MILLS = [0, 2500, 6000, 10000];

function pendingStageIndex(elapsed) {
  let index = 0;
  PENDING_STAGE_MILLS.forEach((threshold, i) => {
    if (elapsed >= threshold) index = i;
  });
  return index;
}

function greetingFor(agentCode) {
  return {
    role: "assistant",
    text: agentCode === "lower-primary-tutor"
      ? "嗨，我是小智！我会一次陪你学一小步。准备好了吗？"
      : "你好，我是你的 AI 学习助教。可以从左侧选择主题，或直接输入问题开始学习。",
    // 低年级先看图再认字：问候语也配一张小智的画。
    picture: agentCode === "lower-primary-tutor"
      ? { src: "/assets/experience/primary/mascot-wave.webp", alt: "小智在挥手", caption: "小智在这里陪你学" }
      : null,
  };
}

function createSessionId() {
  return `web-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

function sessionStorageKey(session, agentCode) {
  return `k12-teaching-session:${agentCode}:${session?.username || session?.user?.username || "anonymous"}`;
}

function getOrCreateSessionId(session, agentCode) {
  if (!session) return createSessionId();
  const key = sessionStorageKey(session, agentCode);
  const stored = sessionStorage.getItem(key);
  if (stored) return stored;
  const created = createSessionId();
  sessionStorage.setItem(key, created);
  return created;
}

function formatGrade(profile) {
  const grade = Number(profile?.grade);
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return undefined;
  const numbers = ["一", "二", "三", "四", "五", "六"];
  if (grade <= 6) return `小学${numbers[grade - 1]}年级`;
  if (grade <= 9) return `初中${numbers[grade - 7]}年级`;
  return `高中${numbers[grade - 10]}年级`;
}

function safeWebUri(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function isBarAnimation(artifact) {
  const type = artifact?.payload?.animationType;
  return artifact?.kind === "ANIMATION" && [
    "bubble-sort",
    "selection-sort",
    "insertion-sort",
    "linear-search",
    "binary-search",
  ].includes(type);
}

function ReferenceSource({ reference }) {
  const sourceUri = safeWebUri(reference.sourceUri);
  const resourceId = /^teaching-resource-([1-9]\d*)$/.exec(reference.documentId || "")?.[1];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (sourceUri) {
    return <a href={sourceUri} target="_blank" rel="noreferrer" title="打开资料来源"><ExternalLink size={13} /></a>;
  }
  if (!resourceId) return null;

  async function openResource() {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      setError("浏览器阻止了新窗口");
      return;
    }
    tab.opener = null;
    setError("");
    setLoading(true);
    try {
      const { url } = await teachingResourcesApi.publishedDownload(resourceId);
      const safeUrl = safeWebUri(url);
      if (!safeUrl) throw new Error("下载地址无效");
      tab.location.replace(safeUrl);
    } catch (cause) {
      tab.close();
      setError(cause.message || "资料暂时无法打开");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="reference-action">
      <button type="button" title="打开已发布资料" aria-label="打开已发布资料" disabled={loading} onClick={openResource}>
        <ExternalLink size={13} />
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}

function KnowledgeGrounding({ grounding }) {
  if (!grounding) return null;
  const references = grounding.status === "USED" && Array.isArray(grounding.references)
    ? grounding.references
    : [];
  const notice = friendlyGroundingNotice(grounding);

  return (
    <section className={`knowledge-grounding status-${String(grounding.status || "unknown").toLowerCase()}`}>
      <div className="grounding-heading">
        <BookOpenText size={14} />
        <span>{references.length ? "推荐学习资料" : "学习资料"}</span>
      </div>
      {notice && <p>{notice}</p>}
      {references.length > 0 && (
        <ol>
          {references.map((reference, index) => (
            <li key={reference.chunkId || `${reference.documentId}-${index}`}>
              <div>
                <strong>{reference.title || "课程资料"}</strong>
                {reference.chapter && <small>{reference.chapter}</small>}
              </div>
              <ReferenceSource reference={reference} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function friendlyGroundingNotice(grounding) {
  const raw = String(grounding?.notice || "").trim();
  const status = String(grounding?.status || "").toUpperCase();
  if (status === "USED" && Array.isArray(grounding.references) && grounding.references.length) {
    return raw && !/未启用|未配置|向量|Neo4j|Runtime|pgvector/i.test(raw)
      ? raw
      : "以下资料可供对照阅读。";
  }
  if (/未启用|未配置|disabled|not_configured|向量库|检索未/i.test(raw) || status === "DISABLED" || status === "NOT_CONFIGURED") {
    return "这次没有匹配到课程资料，回答仅供参考。";
  }
  if (/模板|deterministic|本地教学/i.test(raw)) {
    return "本次用课堂讲解方式回答，未引用额外资料。";
  }
  if (!raw) return "这次没有匹配到课程资料，回答仅供参考。";
  if (/Neo4j|Runtime|pgvector|MinIO|agent/i.test(raw)) {
    return "这次没有匹配到课程资料，回答仅供参考。";
  }
  return raw;
}

function CourseRecommendations({ items }) {
  if (!Array.isArray(items) || !items.length) return null;

  function openCourseChapter(courseId, chapterId) {
    const path = `${window.location.pathname || "/"}#courses/${courseId}/chapters/${chapterId}`;
    const url = `${window.location.origin}${path}`;
    // 不要带 noopener：部分浏览器会让 window.open 返回 null，误走当前页 hash 跳转。
    const tab = window.open(url, "_blank");
    if (!tab) {
      // 仅弹窗被拦截时，才退回当前页跳转
      window.location.hash = `#courses/${courseId}/chapters/${chapterId}`;
    }
  }

  return (
    <section className="knowledge-grounding course-recs">
      <div className="grounding-heading">
        <BookOpenText size={14} />
        <span>推荐课程章节</span>
      </div>
      <p>根据你刚学的主题推荐相关课程章节；点击在新标签打开，当前对话不会被打断。</p>
      <ol>
        {items.map((item) => {
          const courseId = Number(item.courseId);
          const chapterId = Number(item.chapterId);
          if (!Number.isInteger(courseId) || courseId < 1 || !Number.isInteger(chapterId) || chapterId < 1) {
            return null;
          }
          return (
            <li key={`${courseId}-${chapterId}`}>
              <div>
                <strong>{item.courseTitle || "相关课程"}</strong>
                <small>{item.chapterTitle || "推荐章节"}</small>
              </div>
              <button
                type="button"
                title="新标签打开课程章节"
                aria-label="新标签打开课程章节"
                onClick={() => openCourseChapter(courseId, chapterId)}
              >
                <ExternalLink size={13} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MultimodalNextSteps({ animationArtifact, onOpenCodeLab }) {
  if (!isBarAnimation(animationArtifact)) return null;
  const type = animationArtifact?.payload?.animationType;
  const labByType = {
    "bubble-sort": { label: "冒泡排序", exampleId: "bubble-sort" },
    "selection-sort": { label: "选择排序", exampleId: "selection-sort" },
    "insertion-sort": { label: "插入排序", exampleId: "insertion-sort" },
    "linear-search": { label: "线性查找", exampleId: "linear-search" },
    "binary-search": { label: "二分查找", exampleId: "binary-search" },
  };
  const lab = labByType[type];
  if (!lab) return null;

  return (
    <section className="multimodal-next">
      <div>
        <strong>继续动手实践</strong>
        <p>打开编程实验，运行{lab.label} Python 示例，对照动画理解过程。</p>
      </div>
      <button
        className="button secondary compact"
        type="button"
        onClick={() => {
          sessionStorage.setItem("k12-codelab-example", lab.exampleId);
          onOpenCodeLab?.(lab.exampleId);
        }}
      >
        <Code2 size={14} />
        打开编程实验
      </button>
    </section>
  );
}

// 提示分级（需求 §4.2）：反问引导 → 思路提示 → 局部提示 → 直接答案。
const HINT_LEVEL_EMOJI = ["", "🤔", "🧭", "🔍", "✅"];
const HINT_LEVEL_NAMES = ["", "反问引导", "思路提示", "局部提示", "直接答案"];

function buildHint(question, level) {
  const correctIndex = question.options.findIndex((option) => option.id === question.correctOptionId);
  const correctLetter = String.fromCharCode(65 + Math.max(correctIndex, 0));
  if (level === 1) {
    const focus = String(question.prompt || "").replace(/^[^，。？?]{0,4}/, "").slice(0, 24) || "这道题";
    return `先想一想：${focus}……它到底在问什么？把画面在脑子里过一遍，再看选项。`;
  }
  if (level === 2) {
    return question.hint || "换个生活例子想：哪个选项和你平时见到的情况对得上？想想每个选项和问题的关系。";
  }
  if (level === 3) {
    // 局部提示：稳定地排除一个错误选项（取第一个非正确项），缩小选择范围。
    const wrong = question.options.find((option) => option.id !== question.correctOptionId);
    const wrongIndex = question.options.findIndex((option) => option.id === wrong?.id);
    const wrongLetter = wrong ? String.fromCharCode(65 + wrongIndex) : "";
    return `先排除一个：${wrongLetter ? `“${wrongLetter}”肯定不对，` : ""}再看看剩下的选项有什么不同。`;
  }
  return `答案是 ${correctLetter}。${question.explanation || "再读一遍解析，加深印象。"}`;
}

function PracticeQuiz({ artifact, runId, onPracticeRecorded, onOpenChallenge, illustrated = false }) {
  const payload = artifact?.payload;
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState({});
  const [recorded, setRecorded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setAnswers({});
    setHints({});
    setRecorded(null);
    setError("");
    if (runId && artifact?.mimeType === "application/vnd.k12.quiz.v1+json") {
      practiceApi.byRun(runId)
        .then((value) => {
          if (active && value) setRecorded(value);
        })
        .catch((requestError) => {
          // 兼容旧后端仍返回 404 表示未作答
          if (active && requestError.status !== 404) setError("暂时无法读取练习记录");
        });
    }
    return () => {
      active = false;
    };
  }, [runId, artifact?.artifactId]);

  if (artifact?.mimeType !== "application/vnd.k12.quiz.v1+json" || !questions.length) {
    return null;
  }

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const submitted = Boolean(recorded);
  // 用过的提示总数随练习一起上送，作为学习证据的一部分（后端 hintCount 上限 20）。
  const hintCount = Object.values(hints).reduce((sum, level) => sum + level, 0);

  function requestHint(question) {
    setHints((current) => ({
      ...current,
      [question.id]: Math.min(4, (current[question.id] || 0) + 1),
    }));
  }

  async function submitAnswers() {
    if (!runId || saving || answeredCount !== questions.length) return;
    setSaving(true);
    setError("");
    try {
      const result = await practiceApi.submit({
        runId,
        hintCount: Math.min(20, hintCount),
        answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
      });
      setRecorded(result);
      onPracticeRecorded?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="practice-quiz" aria-label={payload.title || "课堂小测"}>
      <header>
        <div>
          <small>形成性练习</small>
          <strong>{payload.title || "课堂小测"}</strong>
        </div>
        {submitted && <span>{recorded.score}/{recorded.maxScore}</span>}
      </header>
      {questions.map((question, questionIndex) => {
        const selected = answers[question.id];
        const correct = submitted && selected === question.correctOptionId;
        const hintLevel = hints[question.id] || 0;
        return (
          <fieldset key={question.id} disabled={submitted} className={illustrated ? "illustrated" : ""}>
            <legend>{questionIndex + 1}. {question.prompt}</legend>
            <QuestionVisual visual={question.visual || emojiVisualFor(question.prompt, illustrated)} />
            {question.options.map((option, optionIndex) => {
              const optionEmoji = illustrated ? primaryEmojiFor(option.text) : "";
              return (
              <label
                className={
                  submitted && option.id === question.correctOptionId
                    ? "correct"
                    : submitted && selected === option.id
                      ? "wrong"
                      : ""
                }
                key={option.id}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                />
                {illustrated && (
                  <span className="quiz-option-lead">
                    <span className={`quiz-option-letter tone-${optionIndex % 4}`} aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
                    {optionEmoji && <span className="quiz-option-emoji" aria-hidden="true">{optionEmoji}</span>}
                  </span>
                )}
                <span>{option.text}</span>
                {submitted && option.id === question.correctOptionId && <CheckCircle2 size={14} />}
              </label>
              );
            })}
            {!submitted && (
              <div className="quiz-hint-block">
                <button
                  className="quiz-hint-button"
                  type="button"
                  disabled={hintLevel >= 4}
                  onClick={() => requestHint(question)}
                >
                  <Lightbulb size={13} />
                  {hintLevel ? "再要一个提示" : "要个提示"}
                </button>
                {hintLevel > 0 && (
                  <p className="quiz-hint-text" data-level={hintLevel}>
                    <span className="quiz-hint-badge">
                      {HINT_LEVEL_EMOJI[hintLevel]} 第{hintLevel}级 · {HINT_LEVEL_NAMES[hintLevel]}
                    </span>
                    {buildHint(question, hintLevel)}
                  </p>
                )}
              </div>
            )}
            {submitted && selected && (
              <p className={correct ? "quiz-feedback correct" : "quiz-feedback"}>{question.explanation}</p>
            )}
          </fieldset>
        );
      })}
      {!submitted ? (
        <button
          className="quiz-submit"
          type="button"
          disabled={!runId || saving || answeredCount !== questions.length}
          onClick={submitAnswers}
        >
          {saving ? "正在记录" : "提交答案"}
        </button>
      ) : (
        <footer>
          本次练习已记录，成绩计入挑战积分与排行榜。
          {onOpenChallenge && (
            <button className="text-button quiz-challenge-link" type="button" onClick={onOpenChallenge}>
              去知识闯关<ArrowRight size={13} />
            </button>
          )}
        </footer>
      )}
      {error && <p className="quiz-feedback">{error}</p>}
      {!submitted && <footer>提交后会保存练习结果，不计入作业或考试成绩。</footer>}
    </section>
  );
}

function QuestionVisual({ visual }) {
  if (!visual?.value) return null;

  if (visual.kind === "image") {
    return (
      <div className="practice-quiz-visual image">
        <img src={visual.value} alt={visual.alt || "题目图片"} />
      </div>
    );
  }

  return (
    <div className="practice-quiz-visual emoji" role="img" aria-label={visual.alt || "题目图片卡"}>
      {visual.value}
    </div>
  );
}

/** 低年级题干没有配图时，按题意给一张 emoji 图卡；没把握就不给。 */
function emojiVisualFor(prompt, illustrated) {
  if (!illustrated) return null;
  const value = primaryEmojiFor(prompt);
  return value ? { kind: "emoji", value, alt: "题目插图" } : null;
}

function GuidedChoices({ guidedTurn, active, disabled, onChoose }) {
  if (!guidedTurn || !Array.isArray(guidedTurn.choices)) return null;
  const current = Number(guidedTurn.progressCurrent) || 1;
  const total = Number(guidedTurn.progressTotal) || 3;
  const phaseLabels = { LOOK: "先看看", THINK: "想一想", TRY: "试一试" };

  return (
    <section className="guided-turn" aria-label="小智互动选择">
      <header>
        <span>{phaseLabels[guidedTurn.phase] || "一起学"}</span>
        <div className="guided-progress" aria-label={`第 ${current} 步，共 ${total} 步`}>
          {Array.from({ length: total }, (_, index) => (
            <i className={index < current ? "complete" : ""} key={index} />
          ))}
        </div>
      </header>
      {guidedTurn.encouragement && <p>{guidedTurn.encouragement}</p>}
      <QuestionVisual visual={guidedTurn.visual} />
      <div className="guided-choice-list">
        {guidedTurn.choices.slice(0, 3).map((choice) => {
          const choiceEmoji = primaryEmojiFor(choice.label);
          return (
            <button
              type="button"
              key={choice.id || choice.label}
              disabled={!active || disabled}
              onClick={() => onChoose(choice.value || choice.label)}
            >
              {choiceEmoji && <span className="guided-choice-emoji" aria-hidden="true">{choiceEmoji}</span>}
              {choice.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** 共用教学对话区：学习台整页与悬浮入口复用同一会话键。 */
export function TeachingAssistantChat({
  session,
  displayName,
  onRequireLogin,
  onPracticeRecorded,
  navigate,
  onOpenChallenge,
  variant = "page",
  activeTopicId,
  onTopicChange,
  seedPrompt,
  onSeedConsumed,
  onLessonState,
  agentCode = "teaching-assistant",
}) {
  const greeting = greetingFor(agentCode);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId(session, agentCode));
  const [conversation, setConversation] = useState([greeting]);
  const [lastTopicCode, setLastTopicCode] = useState(null);
  const [recording, setRecording] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [pendingElapsed, setPendingElapsed] = useState(0);
  const conversationRef = useRef(null);
  const proactiveSessionRef = useRef("");
  const voiceRecorderRef = useRef(null);
  const micLevelRef = useRef(0);
  const micWatchRef = useRef(0);
  const voiceAutoSpeakRef = useRef(false);
  const speakAudioRef = useRef(null);
  const stageCode = stageCodes[profile?.schoolStage];
  const isPage = variant === "page";
  const isLowerPrimary = agentCode === "lower-primary-tutor";
  // 编程实验只属于初高中学段：小学（含高年级）不出现「打开编程实验」入口
  const isTeenStage = profile?.schoolStage === "JUNIOR_HIGH" || profile?.schoolStage === "SENIOR_HIGH";

  useEffect(() => {
    const pane = conversationRef.current;
    if (!pane) return;
    pane.scrollTop = pane.scrollHeight;
  }, [conversation, sending, restoring]);

  // 五阶段状态：回答期间按耗时推进（§5.2），回答结束回到「等待学生反馈」。
  useEffect(() => {
    if (!sending) {
      setPendingElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setPendingElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [sending]);

  useEffect(() => {
    if (session) return;
    setQuestion("");
  }, [session]);

  // 低年级语音输入：再点一次结束录音；组件卸载或切换会话时放弃录音。
  useEffect(() => () => {
    window.clearTimeout(micWatchRef.current);
    voiceRecorderRef.current?.abort();
    voiceRecorderRef.current = null;
    speakAudioRef.current?.pause();
    speakAudioRef.current = null;
  }, []);

  function stopSpeaking() {
    speakAudioRef.current?.pause();
    speakAudioRef.current = null;
  }

  // 语音提问后的回复自动朗读（仅当本轮用说话提问）。
  async function speakReply(text) {
    const content = String(text || "").trim();
    if (!content) return;
    stopSpeaking();
    try {
      const result = await speechApi.synthesize(content.slice(0, 800));
      const audio = new Audio(URL.createObjectURL(result.blob));
      speakAudioRef.current = audio;
      audio.onended = () => {
        speakAudioRef.current = null;
      };
      await audio.play();
    } catch {
      /* 朗读失败静默降级，不打断对话 */
    }
  }

  async function startVoiceInput() {
    if (recording || transcribing || sending || restoring) return;
    setVoiceError("");
    setMicReady(false);
    setMicLevel(0);
    micLevelRef.current = 0;
    const recorder = createVoiceRecorder({
      onAutoStop: () => {
        window.clearTimeout(micWatchRef.current);
        setRecording(false);
        voiceRecorderRef.current = null;
        transcribeRecording(recorder);
      },
      // 第一帧音频到达才算真正开始收声，提示孩子此时再开口（之前开口会丢字）
      onReady: () => {
        setMicReady(true);
        window.clearTimeout(micWatchRef.current);
        micWatchRef.current = window.setTimeout(() => {
          if (micLevelRef.current < 0.02) {
            window.clearTimeout(micWatchRef.current);
            voiceRecorderRef.current?.abort();
            voiceRecorderRef.current = null;
            setRecording(false);
            setVoiceError("小智一点声音都没听到，请在设置里允许麦克风，或者换个浏览器再试");
          }
        }, 3000);
      },
      onLevel: (value) => {
        micLevelRef.current = Math.max(micLevelRef.current, value);
        setMicLevel(value);
      },
    });
    try {
      await recorder.start();
      voiceRecorderRef.current = recorder;
      setRecording(true);
    } catch (caught) {
      const denied = caught?.name === "NotAllowedError" || caught?.name === "SecurityError";
      setVoiceError(denied ? "请允许使用麦克风，小智才能听你说话" : "这个设备暂时不能录音，请用打字告诉小智");
    }
  }

  function stopVoiceInput() {
    const recorder = voiceRecorderRef.current;
    if (!recorder) return;
    window.clearTimeout(micWatchRef.current);
    voiceRecorderRef.current = null;
    setRecording(false);
    transcribeRecording(recorder);
  }

  async function transcribeRecording(recorder) {
    setTranscribing(true);
    try {
      const { blob, seconds, peak } = await recorder.stop();
      if (!blob || blob.size < 1000) {
        setVoiceError("好像没录到声音，请靠近一点再说一遍");
        return;
      }
      if (seconds < 0.8) {
        setVoiceError("话太短啦，点一下说话，讲完再点一下方块");
        return;
      }
      // 录到的是静音/底噪：ASR 必然"听不清"，直接告诉孩子怎么解决
      if (peak < 0.015) {
        setVoiceError("小智一点声音都没听到，请在设置里允许麦克风，或者换个浏览器再试");
        return;
      }
      if (peak < 0.06) {
        setVoiceError("声音有点小，靠近一点、大声一点，小智才听得清");
        return;
      }
      const result = await speechApi.recognize(await blobToBase64(blob), "audio/wav");
      const text = String(result?.text || "").trim();
      if (!text) {
        setVoiceError("小智没听清，请再说一遍");
        return;
      }
      // 语音闭环：识别成功直接提问，回复用声音答给孩子。
      setQuestion("");
      setVoiceError("");
      ask(text, { speakReply: true });
    } catch (caught) {
      setVoiceError(caught?.message || "语音识别失败了，请稍后再试");
    } finally {
      setTranscribing(false);
    }
  }

  useEffect(() => {
    setHistoryReady(false);
    setSessionId(getOrCreateSessionId(session, agentCode));
    setConversation([greetingFor(agentCode)]);
    setLastTopicCode(null);
    proactiveSessionRef.current = "";
  }, [session, agentCode]);

  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      return () => {
        active = false;
      };
    }
    profileApi.getLearningProfile()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session) {
      setConversation([greeting]);
      setRestoring(false);
      setHistoryReady(true);
      return () => {
        active = false;
      };
    }

    setRestoring(true);
    agentsApi.sessionHistory(agentCode, sessionId)
      .then((value) => {
        if (!active) return;
        const restored = (value?.turns || []).flatMap((turn) => {
          const metadata = turn.outputMetadata || {};
          const gameArtifact = Array.isArray(turn.artifacts)
            ? turn.artifacts.find((artifact) => artifact.kind === "GAME")
            : null;
          const animationArtifact = Array.isArray(turn.artifacts)
            ? turn.artifacts.find((artifact) => artifact.kind === "ANIMATION")
            : null;
          const coursewareArtifact = Array.isArray(turn.artifacts)
            ? turn.artifacts.find((artifact) => isCoursewareArtifact(artifact))
            : null;
          return [
            { role: "user", text: turn.userMessage, runId: turn.runId },
            {
              role: "assistant",
              text: turn.assistantMessage,
              // 历史回复同样按话题码补图，刷新后不至于只剩文字。
              picture: isLowerPrimary
                ? primaryPictureFor({ text: turn.assistantMessage, topicCode: metadata.topicCode })
                : null,
              grounding: metadata.knowledgeGrounding || null,
              courseRecommendations: metadata.courseRecommendations || [],
              guidedTurn: metadata.guidedConversation || null,
              animationArtifact,
              gameArtifact,
              coursewareArtifact,
              topicTitle: metadata.topic || null,
              topicCode: metadata.topicCode || null,
              nextTopics: metadata.knowledgeGraph?.nextTopics || [],
              weakPoints: metadata.weakPoints || [],
              runId: turn.runId,
            },
          ];
        });
        setConversation(restored.length ? [greeting, ...restored] : [greeting]);
      })
      .catch(() => {
        if (active) setConversation([greeting]);
      })
      .finally(() => {
        if (active) {
          setRestoring(false);
          setHistoryReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [session, sessionId, agentCode]);

  function startNewConversation() {
    const nextSessionId = createSessionId();
    if (session) sessionStorage.setItem(sessionStorageKey(session, agentCode), nextSessionId);
    setHistoryReady(false);
    setSessionId(nextSessionId);
    setConversation([greeting]);
    setError("");
    onTopicChange?.(null);
  }

  async function ask(text, { topicId, topicCode, preferDeterministic = false, requirePractice = false, speakReply: shouldSpeak = false } = {}) {
    const content = text.trim();
    if (!content || restoring || sending) return;
    if (!session) {
      onRequireLogin?.();
      return;
    }
    voiceAutoSpeakRef.current = shouldSpeak;
    stopSpeaking();
    if (topicId) onTopicChange?.(topicId);
    setQuestion("");
    setError("");
    setConversation((current) => [...current, { role: "user", text: content }]);
    setSending(true);
    const turnTopicCode = topicCodeForId(topicId) || topicCode || lastTopicCode || undefined;
    // 低年级回答配插图：优先按话题码找绘本画，再按问题关键词猜。
    const turnPicture = isLowerPrimary
      ? primaryPictureFor({ text: content, topicCode: turnTopicCode })
      : null;
    try {
      const run = await agentsApi.run(agentCode, {
        inputText: content,
        sessionId,
        executionMode: "SYNC",
        context: {
          source: isPage ? "user-web-studio" : "user-web",
          stage: stageCode,
          grade: formatGrade(profile),
          textbook: profile?.textbook || undefined,
          preferredInteraction: requirePractice ? ["小测", "互动练习"] : ["对话问答"],
          preferDeterministic: Boolean(preferDeterministic),
          requirePracticeArtifact: requirePractice || undefined,
          topicCode: turnTopicCode,
        },
      });
      const metadata = run.outputMetadata || run.metadata || {};
      if (metadata.topicCode) setLastTopicCode(metadata.topicCode);
      const gameArtifact = Array.isArray(run.artifacts)
        ? run.artifacts.find((artifact) => artifact.kind === "GAME")
        : null;
      const animationArtifact = Array.isArray(run.artifacts)
        ? run.artifacts.find((artifact) => artifact.kind === "ANIMATION")
        : null;
      const coursewareArtifact = Array.isArray(run.artifacts)
        ? run.artifacts.find((artifact) => isCoursewareArtifact(artifact))
        : null;
      setConversation((current) => [...current, {
        role: "assistant",
        text: run.outputText || "讲解还在准备中，请稍后再问一次。",
        picture: turnPicture,
        grounding: metadata.knowledgeGrounding || null,
        courseRecommendations: metadata.courseRecommendations || [],
        guidedTurn: metadata.guidedConversation || null,
        animationArtifact,
        gameArtifact,
        coursewareArtifact,
        topicTitle: metadata.topic || null,
        topicCode: metadata.topicCode || null,
        nextTopics: metadata.knowledgeGraph?.nextTopics || [],
        weakPoints: metadata.weakPoints || [],
        runId: run.runId,
      }]);
      if (voiceAutoSpeakRef.current) {
        voiceAutoSpeakRef.current = false;
        speakReply(run.outputText);
      }
    } catch (requestError) {
      setError(requestError.message);
      // 失败也要给可执行的替代动作（§5.2），不留死胡同。
      setConversation((current) => [...current, { role: "assistant", text: "这次没有连上 AI 服务。点输入框上方的重试提示再试一次，或者换个问法问我。" }]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!seedPrompt?.prompt || restoring || sending) return;
    const { prompt, topicId, topicCode, preferDeterministic } = seedPrompt;
    onSeedConsumed?.();
    ask(prompt, { topicId, topicCode, preferDeterministic: Boolean(preferDeterministic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire when seed arrives
  }, [seedPrompt, restoring, sending]);

  useEffect(() => {
    if (
      !isPage
      || !isLowerPrimary
      || !session
      || !historyReady
      || restoring
      || sending
      || seedPrompt?.prompt
      || conversation.length !== 1
      || proactiveSessionRef.current === sessionId
    ) return;
    proactiveSessionRef.current = sessionId;
    ask("小智，带我开始今天的 AI 探索。", {
      topicId: "image-classification",
      preferDeterministic: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each restored session starts at most once
  }, [historyReady, sessionId, conversation.length, isLowerPrimary, isPage]);

  function submit(event) {
    event.preventDefault();
    // 自由输入才走模型；下拉预设已带 preferDeterministic
    ask(question, { preferDeterministic: false });
  }

  function openCodeLab(exampleId) {
    sessionStorage.setItem("k12-codelab-example", exampleId);
    navigate?.("code-lab");
    window.dispatchEvent(new CustomEvent("k12-open-codelab", { detail: { exampleId } }));
  }

  // 讲解完一个知识点后的一键闯关：让助教当场出一组小测（requirePracticeArtifact 确保出题）。
  // topicCode 一并带上：自由文本再次匹配可能落空，带码走 _topic_for_state 必中目录主题。
  function askChallengeQuiz(topicTitle, topicCode) {
    ask(`给我来一组「${topicTitle}」的闯关小测，答完当场判分并讲解析。`, {
      topicCode,
      preferDeterministic: true,
      requirePractice: true,
    });
  }

  const statusBusy = restoring || sending;
  const hasConversationMemory = conversation.some(
    (message) => message.role === "assistant" && message.runId,
  ) || conversation.filter((message) => message.role === "user").length > 1;
  const activeStage = PENDING_STAGES[pendingStageIndex(pendingElapsed)];
  // 第五阶段：回答结束后就停在「等待学生反馈」，右栏面板与头部状态共用。
  const stageLabelText = restoring
    ? "恢复会话"
    : sending ? activeStage.label
      : hasConversationMemory ? "等待学生反馈"
        : "在线";
  const statusLabel = stageLabelText;
  const pendingLabel = restoring
    ? "正在恢复当前对话记忆…"
    : `${activeStage.emoji} 正在${activeStage.label}…`;

  // 右栏「课堂面板」数据源：状态 + 本课任务 + 课堂产物 + 下一步。
  const lessonState = useMemo(() => {
    const artifacts = [];
    let lastAssistant = null;
    conversation.forEach((message, messageIndex) => {
      if (message.role !== "assistant") return;
      const messageKey = `chat-msg-${messageIndex}`;
      if (message.gameArtifact) {
        artifacts.push({
          kind: "QUIZ",
          title: message.gameArtifact.payload?.title || "课堂小测",
          messageKey,
        });
      }
      if (message.animationArtifact) {
        artifacts.push({
          kind: "ANIMATION",
          title: message.animationArtifact.payload?.title || "动画演示",
          messageKey,
        });
      }
      if (message.coursewareArtifact) {
        artifacts.push({
          kind: "COURSEWARE",
          title: message.coursewareArtifact.payload?.title || "互动课件",
          messageKey,
        });
      }
      if (message.runId) lastAssistant = message;
    });
    const guided = lastAssistant?.guidedTurn || null;
    return {
      busy: statusBusy,
      stageLabel: stageLabelText,
      topicCode: lastTopicCode,
      topicTitle: lastAssistant?.topicTitle || null,
      phase: guided?.phase || null,
      progressCurrent: guided?.progressCurrent || null,
      progressTotal: guided?.progressTotal || null,
      artifacts,
      nextTopics: lastAssistant?.nextTopics || [],
      weakPoints: lastAssistant?.weakPoints || [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 状态变化时重算并外发
  }, [conversation, statusBusy, stageLabelText, lastTopicCode]);

  useEffect(() => {
    onLessonState?.(lessonState);
  }, [lessonState, onLessonState]);

  const visibleConversation = conversation.slice(-30);
  const messageOffset = conversation.length - visibleConversation.length;
  const lastAssistantIndex = visibleConversation.reduce(
    (latest, message, index) => (message.role === "assistant" ? index : latest),
    -1,
  );

  return (
    <section
      className={`teaching-chat ${isPage ? "page-variant" : "floating-variant"} ${isLowerPrimary ? "lower-primary-chat" : ""}`}
      aria-label={isLowerPrimary ? "小智陪学对话" : "AI 学习对话"}
    >
      <header className="teaching-chat-head">
        <span className="assistant-avatar">
          <img src={ASSISTANT_ICON} alt="" width={28} height={28} />
        </span>
        <div>
          <strong>{isLowerPrimary ? "小智陪学模式" : isPage ? "AI 通识讲解" : "AI 学习助教"}</strong>
          <small className={statusBusy ? "status-busy" : undefined}>
            <i />
            {statusLabel}
            {profile?.grade ? ` · ${formatGrade(profile) || ""}` : ""}
          </small>
        </div>
        <button
          className="assistant-control"
          type="button"
          title="新建对话"
          onClick={startNewConversation}
          disabled={sending || restoring}
        >
          <MessageSquarePlus size={18} />
        </button>
      </header>

      <div className="conversation" ref={conversationRef} aria-live="polite">
        {visibleConversation.map((message, index) => (
          <div
            className={`message ${message.role} ${message.animationArtifact ? "has-animation" : ""}`}
            key={`${message.runId || "local"}-${message.role}-${index}`}
            id={`chat-msg-${messageOffset + index}`}
          >
            <span>
              {message.role === "assistant"
                ? <img src={ASSISTANT_ICON} alt="" width={20} height={20} />
                : displayName.slice(0, 1)}
            </span>
            <div className="message-content">
              {message.role === "assistant" && isLowerPrimary && message.picture && (
                <figure className="assistant-picture">
                  <img src={message.picture.src} alt={message.picture.alt || "小智的插画"} loading="lazy" />
                  <figcaption>{message.picture.caption || "小智画给你看"}</figcaption>
                </figure>
              )}
              {message.role === "assistant" ? (
                <MarkdownContent className="assistant-md">{message.text}</MarkdownContent>
              ) : (
                <p>{message.text}</p>
              )}
              {message.role === "assistant" && !isLowerPrimary && <KnowledgeGrounding grounding={message.grounding} />}
              {message.role === "assistant" && !isLowerPrimary && (
                <CourseRecommendations items={message.courseRecommendations} />
              )}
              {message.role === "assistant" && !isLowerPrimary && <BubbleSortAnimation artifact={message.animationArtifact} />}
              {message.role === "assistant" && !isLowerPrimary && <TeachingSteps artifact={message.animationArtifact} />}
              {message.role === "assistant" && (!isLowerPrimary || message.guidedTurn?.showPractice) && (
                <PracticeQuiz
                  artifact={message.gameArtifact}
                  runId={message.runId}
                  onPracticeRecorded={onPracticeRecorded}
                  onOpenChallenge={onOpenChallenge}
                  illustrated={isLowerPrimary}
                />
              )}
              {message.role === "assistant" && !isLowerPrimary && isTeenStage && (
                <MultimodalNextSteps
                  animationArtifact={message.animationArtifact}
                  onOpenCodeLab={openCodeLab}
                />
              )}
              {message.role === "assistant" && isLowerPrimary && (
                <GuidedChoices
                  guidedTurn={message.guidedTurn}
                  active={index === lastAssistantIndex}
                  disabled={sending || restoring}
                  onChoose={(value) => ask(value, { preferDeterministic: true })}
                />
              )}
              {message.role === "assistant" && message.coursewareArtifact && (
                <CoursewarePlayer artifact={message.coursewareArtifact} />
              )}
              {message.role === "assistant" && index === lastAssistantIndex && !statusBusy
                && message.topicCode && PLAYABLE_CODES.has(message.topicCode) && !message.gameArtifact && (
                <button className="challenge-convert" type="button" onClick={() => askChallengeQuiz(message.topicTitle, message.topicCode)}>
                  <Zap size={14} />
                  闯关挑战：来一组「{message.topicTitle}」小测，当场判分
                </button>
              )}
            </div>
          </div>
        ))}
        {statusBusy && (
          <div className="message assistant pending" role="status" aria-live="polite">
            <span><img src={ASSISTANT_ICON} alt="" width={20} height={20} /></span>
            <div className="message-content">
              <p className="assistant-pending-bubble">
                <LoaderCircle size={14} aria-hidden="true" />
                <span>{pendingLabel}</span>
                <span className="pending-dots" aria-hidden="true">
                  <i /><i /><i />
                </span>
              </p>
              {!restoring && (
                <p className="pending-stages" aria-hidden="true">
                  {PENDING_STAGES.map((stage, stageIndex) => (
                    <span key={stage.label} className={stage === activeStage ? "current" : stageIndex < PENDING_STAGES.indexOf(activeStage) ? "done" : ""}>
                      {stage.emoji} {stage.label}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="assistant-error">{error}</p>}
      <form className={`assistant-input${isLowerPrimary ? " with-voice" : ""}`} onSubmit={submit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={
            restoring ? "正在恢复历史对话"
              : transcribing ? "小智正在听你说话……"
                : isLowerPrimary ? "告诉小智你的想法" : "输入问题，按 Enter 发送"
          }
          aria-label={isLowerPrimary ? "告诉小智你的想法" : "向 AI 助教提问"}
          disabled={restoring}
        />
        {isLowerPrimary && (
          <button
            className={`send-button voice-button${recording ? " recording" : ""}`}
            type="button"
            title={recording ? "说完点这里" : "点一下说话"}
            aria-pressed={recording}
            disabled={transcribing || sending || restoring}
            onClick={recording ? stopVoiceInput : startVoiceInput}
          >
            {recording ? <Square size={14} /> : <Mic size={17} />}
          </button>
        )}
        <button className="send-button" type="submit" title="发送问题" disabled={sending || restoring}>
          <Send size={17} />
        </button>
      </form>
      {isLowerPrimary && (voiceError || recording) && (
        <p className={voiceError ? "voice-hint voice-hint-error" : "voice-hint"}>
          {voiceError || (
            <>
              {!micReady ? "麦克风准备中…"
                : micLevel < 0.02 ? "小智在听你说啦，大声一点"
                  : "小智在听你说啦，讲完点一下方块"}
              {micReady && (
                <span className="voice-level" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} className={micLevel > (i + 1) * 0.09 ? "on" : ""} />
                  ))}
                </span>
              )}
            </>
          )}
        </p>
      )}
      <footer>{isLowerPrimary ? "一次学一点，答错也没关系" : "AI 回答仅供学习参考"}</footer>
    </section>
  );
}
