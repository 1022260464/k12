import {
  BookOpenText,
  CheckCircle2,
  Code2,
  ExternalLink,
  LoaderCircle,
  MessageSquarePlus,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { agentsApi, practiceApi, profileApi, teachingResourcesApi } from "../api/client.js";
import { BubbleSortAnimation } from "./BubbleSortAnimation.jsx";
import { MarkdownContent } from "./MarkdownContent.jsx";
import { TeachingSteps } from "./TeachingSteps.jsx";
import { topicCodeForId } from "../data/teachingTopics.js";

export { TEACHING_TOPICS, TOPIC_CATEGORIES, topicsByCategory } from "../data/teachingTopics.js";

const ASSISTANT_ICON = "/assets/ai-assistant-doodle.png";

const stageCodes = {
  PRIMARY_LOWER: "lower_primary",
  PRIMARY_UPPER: "upper_primary",
  JUNIOR_HIGH: "middle_school",
  SENIOR_HIGH: "high_school",
};

function greetingFor(agentCode) {
  return {
    role: "assistant",
    text: agentCode === "lower-primary-tutor"
      ? "嗨，我是小智！我会一次陪你学一小步。准备好了吗？"
      : "你好，我是你的 AI 学习助教。可以从左侧选择主题，或直接输入问题开始学习。",
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

function PracticeQuiz({ artifact, runId, onPracticeRecorded }) {
  const payload = artifact?.payload;
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const [answers, setAnswers] = useState({});
  const [recorded, setRecorded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setAnswers({});
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

  async function submitAnswers() {
    if (!runId || saving || answeredCount !== questions.length) return;
    setSaving(true);
    setError("");
    try {
      const result = await practiceApi.submit({
        runId,
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
        return (
          <fieldset key={question.id} disabled={submitted}>
            <legend>{questionIndex + 1}. {question.prompt}</legend>
            <QuestionVisual visual={question.visual} />
            {question.options.map((option) => (
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
                <span>{option.text}</span>
                {submitted && option.id === question.correctOptionId && <CheckCircle2 size={14} />}
              </label>
            ))}
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
        <footer>本次练习已记录。继续提问，助教会参考你的薄弱点调整讲解。</footer>
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
      <div className="guided-choice-list">
        {guidedTurn.choices.slice(0, 3).map((choice) => (
          <button
            type="button"
            key={choice.id || choice.label}
            disabled={!active || disabled}
            onClick={() => onChoose(choice.value || choice.label)}
          >
            {choice.label}
          </button>
        ))}
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
  variant = "page",
  activeTopicId,
  onTopicChange,
  seedPrompt,
  onSeedConsumed,
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
  const conversationRef = useRef(null);
  const proactiveSessionRef = useRef("");
  const stageCode = stageCodes[profile?.schoolStage];
  const isPage = variant === "page";
  const isLowerPrimary = agentCode === "lower-primary-tutor";

  useEffect(() => {
    const pane = conversationRef.current;
    if (!pane) return;
    pane.scrollTop = pane.scrollHeight;
  }, [conversation, sending, restoring]);

  useEffect(() => {
    if (session) return;
    setQuestion("");
  }, [session]);

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
          return [
            { role: "user", text: turn.userMessage, runId: turn.runId },
            {
              role: "assistant",
              text: turn.assistantMessage,
              grounding: metadata.knowledgeGrounding || null,
              courseRecommendations: metadata.courseRecommendations || [],
              guidedTurn: metadata.guidedConversation || null,
              animationArtifact,
              gameArtifact,
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

  async function ask(text, { topicId, preferDeterministic = false } = {}) {
    const content = text.trim();
    if (!content || restoring || sending) return;
    if (!session) {
      onRequireLogin?.();
      return;
    }
    if (topicId) onTopicChange?.(topicId);
    setQuestion("");
    setError("");
    setConversation((current) => [...current, { role: "user", text: content }]);
    setSending(true);
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
          preferredInteraction: ["对话问答"],
          preferDeterministic: Boolean(preferDeterministic),
          topicCode: topicCodeForId(topicId) || lastTopicCode || undefined,
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
      setConversation((current) => [...current, {
        role: "assistant",
        text: run.outputText || "讲解还在准备中，请稍后再问一次。",
        grounding: metadata.knowledgeGrounding || null,
        courseRecommendations: metadata.courseRecommendations || [],
        guidedTurn: metadata.guidedConversation || null,
        animationArtifact,
        gameArtifact,
        runId: run.runId,
      }]);
    } catch (requestError) {
      setError(requestError.message);
      setConversation((current) => [...current, { role: "assistant", text: "暂时无法连接 AI 服务，请稍后重试。" }]);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!seedPrompt?.prompt || restoring || sending) return;
    const { prompt, topicId, preferDeterministic } = seedPrompt;
    onSeedConsumed?.();
    ask(prompt, { topicId, preferDeterministic: Boolean(preferDeterministic) });
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

  const statusLabel = restoring ? "恢复会话中" : sending ? "思考中" : "在线";
  const statusBusy = restoring || sending;
  const hasConversationMemory = conversation.some(
    (message) => message.role === "assistant" && message.runId,
  ) || conversation.filter((message) => message.role === "user").length > 1;
  const pendingLabel = restoring
    ? "正在恢复当前对话记忆…"
    : hasConversationMemory
      ? "正在结合当前对话记忆思考…"
      : "正在思考…";
  const visibleConversation = conversation.slice(-30);
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
          >
            <span>
              {message.role === "assistant"
                ? <img src={ASSISTANT_ICON} alt="" width={20} height={20} />
                : displayName.slice(0, 1)}
            </span>
            <div className="message-content">
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
                />
              )}
              {message.role === "assistant" && !isLowerPrimary && (
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
            </div>
          </div>
        )}
      </div>

      {error && <p className="assistant-error">{error}</p>}
      <form className="assistant-input" onSubmit={submit}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={restoring ? "正在恢复历史对话" : isLowerPrimary ? "告诉小智你的想法" : "输入问题，按 Enter 发送"}
          aria-label={isLowerPrimary ? "告诉小智你的想法" : "向 AI 助教提问"}
          disabled={restoring}
        />
        <button className="send-button" type="submit" title="发送问题" disabled={sending || restoring}>
          <Send size={17} />
        </button>
      </form>
      <footer>{isLowerPrimary ? "一次学一点，答错也没关系" : "AI 回答仅供学习参考"}</footer>
    </section>
  );
}
