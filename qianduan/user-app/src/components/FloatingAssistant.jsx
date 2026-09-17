import {
  BookOpenText,
  Bot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  MessageSquarePlus,
  MessageSquareText,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi, practiceApi, profileApi } from "../api/client.js";

const stageCodes = {
  PRIMARY_LOWER: "lower_primary",
  PRIMARY_UPPER: "upper_primary",
  JUNIOR_HIGH: "middle_school",
  SENIOR_HIGH: "high_school",
};

const greeting = { role: "assistant", text: "你好，我是你的 AI 学习助教。今天想学习哪个人工智能知识点？" };

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

function KnowledgeGrounding({ grounding }) {
  if (!grounding) return null;
  const references = grounding.status === "USED" && Array.isArray(grounding.references)
    ? grounding.references
    : [];

  return (
    <section className={`knowledge-grounding status-${String(grounding.status || "unknown").toLowerCase()}`}>
      <div className="grounding-heading"><BookOpenText size={14} /><span>{references.length ? "参考资料" : "知识库状态"}</span></div>
      <p>{grounding.notice}</p>
      {references.length > 0 && <ol>{references.map((reference, index) => {
        const sourceUri = safeWebUri(reference.sourceUri);
        return <li key={reference.chunkId || `${reference.documentId}-${index}`}>
          <div><strong>{reference.title || "课程资料"}</strong>{reference.chapter && <small>{reference.chapter}</small>}</div>
          {sourceUri && <a href={sourceUri} target="_blank" rel="noreferrer" title="打开资料来源"><ExternalLink size={13} /></a>}
        </li>;
      })}</ol>}
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
        .then((value) => { if (active) setRecorded(value); })
        .catch((requestError) => { if (active && requestError.status !== 404) setError("暂时无法读取练习记录"); });
    }
    return () => { active = false; };
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
      onPracticeRecorded();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="practice-quiz" aria-label={payload.title || "课堂小测"}>
      <header><div><small>形成性练习</small><strong>{payload.title || "课堂小测"}</strong></div>{submitted && <span>{recorded.score}/{recorded.maxScore}</span>}</header>
      {questions.map((question, questionIndex) => {
        const selected = answers[question.id];
        const correct = submitted && selected === question.correctOptionId;
        return <fieldset key={question.id} disabled={submitted}>
          <legend>{questionIndex + 1}. {question.prompt}</legend>
          {question.options.map((option) => <label className={submitted && option.id === question.correctOptionId ? "correct" : submitted && selected === option.id ? "wrong" : ""} key={option.id}><input type="radio" name={question.id} value={option.id} checked={selected === option.id} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} /><span>{option.text}</span>{submitted && option.id === question.correctOptionId && <CheckCircle2 size={14} />}</label>)}
          {submitted && selected && <p className={correct ? "quiz-feedback correct" : "quiz-feedback"}>{question.explanation}</p>}
        </fieldset>;
      })}
      {!submitted
        ? <button className="quiz-submit" type="button" disabled={!runId || saving || answeredCount !== questions.length} onClick={submitAnswers}>{saving ? "正在记录" : "提交答案"}</button>
        : <footer>本次练习已记录。继续提问，助教会参考你的薄弱点调整讲解。</footer>}
      {error && <p className="quiz-feedback">{error}</p>}
      {!submitted && <footer>提交后会保存练习结果，不计入作业或考试成绩。</footer>}
    </section>
  );
}

export function FloatingAssistant({ session, displayName, onRequireLogin, draftRequest, onPracticeRecorded }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId(session));
  const [conversation, setConversation] = useState([greeting]);

  useEffect(() => {
    if (!draftRequest) return;
    setOpen(true);
    setQuestion(`请继续讲解${draftRequest.topic}，并给我一道新的练习题。`);
  }, [draftRequest]);

  useEffect(() => {
    if (session) return;
    setQuestion("");
    setOpen(false);
  }, [session]);

  useEffect(() => {
    setSessionId(getOrCreateSessionId(session));
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      return () => { active = false; };
    }
    profileApi.getLearningProfile()
      .then((value) => { if (active) setProfile(value); })
      .catch(() => { if (active) setProfile(null); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session) {
      setConversation([greeting]);
      setRestoring(false);
      return () => { active = false; };
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
          return [
            { role: "user", text: turn.userMessage, runId: turn.runId },
            {
              role: "assistant",
              text: turn.assistantMessage,
              grounding: metadata.knowledgeGrounding || null,
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
    return () => { active = false; };
  }, [session, sessionId]);

  function startNewConversation() {
    const nextSessionId = createSessionId();
    if (session) sessionStorage.setItem(sessionStorageKey(session), nextSessionId);
    setSessionId(nextSessionId);
    setConversation([greeting]);
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || restoring) return;
    if (!session) { onRequireLogin(); return; }
    setQuestion("");
    setError("");
    setConversation((current) => [...current, { role: "user", text }]);
    setSending(true);
    try {
      const run = await agentsApi.run("teaching-assistant", {
        inputText: text,
        sessionId,
        executionMode: "SYNC",
        context: {
          source: "user-web",
          stage: stageCodes[profile?.schoolStage],
          grade: formatGrade(profile),
          textbook: profile?.textbook || undefined,
          preferredInteraction: ["对话问答"],
        },
      });
      const metadata = run.outputMetadata || run.metadata || {};
      const gameArtifact = Array.isArray(run.artifacts)
        ? run.artifacts.find((artifact) => artifact.kind === "GAME")
        : null;
      setConversation((current) => [...current, {
        role: "assistant",
        text: run.outputText || "任务已提交，请稍后在运行记录中查看结果。",
        grounding: metadata.knowledgeGrounding || null,
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

  return (
    <aside className={`floating-assistant ${open ? "open" : ""}`} aria-label="AI 学习助教">
      {open ? <section className="assistant-window assistant-popover">
        <header><span className="assistant-avatar"><Bot size={19} /></span><div><strong>AI 学习助教</strong><small><i />{restoring ? "恢复会话中" : sending ? "思考中" : "在线"}</small></div><button className="assistant-control" type="button" title="新建对话" onClick={startNewConversation} disabled={sending || restoring}><MessageSquarePlus size={18} /></button><button className="assistant-control" type="button" title="收起" onClick={() => setOpen(false)}><ChevronDown size={19} /></button></header>
        <div className="conversation" aria-live="polite">{conversation.slice(-20).map((message, index) => <div className={`message ${message.role}`} key={`${message.runId || "local"}-${message.role}-${index}`}><span>{message.role === "assistant" ? <Bot size={16} /> : displayName.slice(0, 1)}</span><div className="message-content"><p>{message.text}</p>{message.role === "assistant" && <KnowledgeGrounding grounding={message.grounding} />}{message.role === "assistant" && <PracticeQuiz artifact={message.gameArtifact} runId={message.runId} onPracticeRecorded={onPracticeRecorded} />}</div></div>)}</div>
        {error && <p className="assistant-error">{error}</p>}
        <form className="assistant-input" onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={restoring ? "正在恢复历史对话" : "输入问题，按 Enter 发送"} aria-label="向 AI 助教提问" disabled={restoring} /><button className="send-button" type="submit" title="发送问题" disabled={sending || restoring}><Send size={17} /></button></form>
        <footer>AI 回答仅供学习参考</footer>
      </section> : <button className="assistant-launcher" type="button" aria-label="打开 AI 学习助教" data-label="问 AI 助教" onClick={() => setOpen(true)}><MessageSquareText size={22} /></button>}
    </aside>
  );
}
