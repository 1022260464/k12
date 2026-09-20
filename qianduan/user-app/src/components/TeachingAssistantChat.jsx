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

export { TEACHING_TOPICS, TOPIC_CATEGORIES, topicsByCategory } from "../data/teachingTopics.js";

const ASSISTANT_ICON = "/assets/ai-assistant-doodle.png";

const stageCodes = {
  PRIMARY_LOWER: "lower_primary",
  PRIMARY_UPPER: "upper_primary",
  JUNIOR_HIGH: "middle_school",
  SENIOR_HIGH: "high_school",
};

const greeting = {
  role: "assistant",
  text: "你好，我是你的 AI 学习助教。可以从左侧选择主题，或直接输入问题开始学习。",
};

function createSessionId() {
  return `web-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

function sessionStorageKey(session) {
  return `k12-teaching-session:${session?.username || session?.user?.username || "anonymous"}`;
}

function getOrCreateSessionId(session) {
  if (!session) return createSessionId();
  const key = sessionStorageKey(session);
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
}) {
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId(session));
  const [conversation, setConversation] = useState([greeting]);
  const [lastTopicCode, setLastTopicCode] = useState(null);
  const conversationRef = useRef(null);
  const stageCode = stageCodes[profile?.schoolStage];
  const isPage = variant === "page";

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
    setSessionId(getOrCreateSessionId(session));
  }, [session]);

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
      return () => {
        active = false;
      };
    }

    setRestoring(true);
    agentsApi.sessionHistory("teaching-assistant", sessionId)
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
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [session, sessionId]);

  function startNewConversation() {
    const nextSessionId = createSessionId();
    if (session) sessionStorage.setItem(sessionStorageKey(session), nextSessionId);
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
      const run = await agentsApi.run("teaching-assistant", {
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
          topicCode: lastTopicCode || undefined,
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

  return (
    <section className={`teaching-chat ${isPage ? "page-variant" : "floating-variant"}`} aria-label="AI 学习对话">
      <header className="teaching-chat-head">
        <span className="assistant-avatar">
          <img src={ASSISTANT_ICON} alt="" width={28} height={28} />
        </span>
        <div>
          <strong>{isPage ? "AI 通识讲解" : "AI 学习助教"}</strong>
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
        {conversation.slice(-30).map((message, index) => (
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
              {message.role === "assistant" && <KnowledgeGrounding grounding={message.grounding} />}
              {message.role === "assistant" && (
                <CourseRecommendations items={message.courseRecommendations} />
              )}
              {message.role === "assistant" && <BubbleSortAnimation artifact={message.animationArtifact} />}
              {message.role === "assistant" && <TeachingSteps artifact={message.animationArtifact} />}
              {message.role === "assistant" && (
                <PracticeQuiz
                  artifact={message.gameArtifact}
                  runId={message.runId}
                  onPracticeRecorded={onPracticeRecorded}
                />
              )}
              {message.role === "assistant" && (
                <MultimodalNextSteps
                  animationArtifact={message.animationArtifact}
                  onOpenCodeLab={openCodeLab}
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
          placeholder={restoring ? "正在恢复历史对话" : "输入问题，按 Enter 发送"}
          aria-label="向 AI 助教提问"
          disabled={restoring}
        />
        <button className="send-button" type="submit" title="发送问题" disabled={sending || restoring}>
          <Send size={17} />
        </button>
      </form>
      <footer>AI 回答仅供学习参考</footer>
    </section>
  );
}
