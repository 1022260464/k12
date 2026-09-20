import {
  BookOpen,
  Bug,
  Code2,
  ExternalLink,
  Lightbulb,
  LoaderCircle,
  Send,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentsApi } from "../api/client.js";

const AGENT_CODE = "python-code-coach";
const SESSION_PREFIX = "k12-code-coach-session:";

/** 官方中文文档：函数库 / 内置函数，便于学生查阅 */
const PYTHON_DOC_LINKS = [
  {
    id: "library",
    label: "标准库一览",
    hint: "常用模块与函数库",
    href: "https://docs.python.org/zh-cn/3/library/index.html",
  },
  {
    id: "builtins",
    label: "内置函数",
    hint: "打印、长度、范围等常用函数",
    href: "https://docs.python.org/zh-cn/3/library/functions.html",
  },
  {
    id: "stdtypes",
    label: "内置类型",
    hint: "列表、字典、字符串",
    href: "https://docs.python.org/zh-cn/3/library/stdtypes.html",
  },
  {
    id: "tutorial",
    label: "入门教程",
    hint: "官方简明教程",
    href: "https://docs.python.org/zh-cn/3/tutorial/index.html",
  },
];

function sessionKey(userId) {
  return `${SESSION_PREFIX}${userId || "guest"}`;
}

function getOrCreateSessionId(session) {
  const key = sessionKey(session?.userId || session?.user?.username);
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = `code-coach-${Date.now().toString(36)}`;
  sessionStorage.setItem(key, created);
  return created;
}

const INTENT_PRESETS = [
  {
    id: "guide",
    label: "指导写代码",
    icon: Wrench,
    question: "请审查我当前的代码，指出问题并指导我怎么改。",
  },
  {
    id: "debug",
    label: "看报错",
    icon: Bug,
    question: "请根据运行报错帮我排查，并给出最小修改建议。",
  },
  {
    id: "explain",
    label: "解释代码",
    icon: Lightbulb,
    question: "请用初中生能懂的话解释这段代码在做什么。",
  },
];

function CoachMarkdown({ text }) {
  return (
    <div className="markdown-body code-coach-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ""}</ReactMarkdown>
    </div>
  );
}

/**
 * 编程实验右侧代码教练对话框：调用独立 agent，不跳转 AI 学习台。
 */
export function CodeCoachPanel({
  open,
  onClose,
  session,
  requireLogin,
  code,
  result,
  error,
  exampleLabel,
  initialIntent = "guide",
  hasRunError = false,
}) {
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId(session));
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [askError, setAskError] = useState("");
  const [pendingIntent, setPendingIntent] = useState(initialIntent);
  const listRef = useRef(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId(session));
  }, [session]);

  useEffect(() => {
    const pane = listRef.current;
    if (!pane) return;
    pane.scrollTop = pane.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) {
      bootstrapped.current = false;
      return;
    }
    setPendingIntent(initialIntent);
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    setMessages([{
      role: "assistant",
      text: "我是编程实验的**代码教练**，只帮你看 Python 代码和报错。\n\n选下方快捷方式，或直接提问。",
    }]);
    const preset = INTENT_PRESETS.find((item) => item.id === initialIntent);
    if (preset && session) {
      if (preset.id === "debug" && !hasRunError) return;
      window.setTimeout(() => {
        ask(preset.question, preset.id);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在打开面板时引导一次
  }, [open, initialIntent, session, hasRunError]);

  async function ask(question, intent = "guide") {
    if (!session) {
      requireLogin();
      return;
    }
    const content = String(question || "").trim();
    if (!content || sending) return;

    setSending(true);
    setAskError("");
    setMessages((current) => [...current, { role: "user", text: content }]);
    setDraft("");

    try {
      const run = await agentsApi.run(AGENT_CODE, {
        inputText: content,
        sessionId,
        executionMode: "SYNC",
        context: {
          source: "code-lab",
          intent,
          exampleLabel: exampleLabel || undefined,
          code: code || "",
          stdout: result?.stdout || "",
          stderr: result?.stderr || error || "",
          runStatus: result?.status || (error ? "FAILED" : ""),
        },
      });
      setMessages((current) => [...current, {
        role: "assistant",
        text: run?.outputText || "暂时没有返回内容，请再试一次。",
      }]);
    } catch (requestError) {
      setAskError("代码教练暂时连不上，请稍后再试");
      setMessages((current) => [...current, {
        role: "assistant",
        text: "代码教练暂时连不上，请稍后再试；若一直失败，请联系老师。",
      }]);
    } finally {
      setSending(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    ask(draft, pendingIntent || "guide");
  }

  if (!open) return null;

  return (
    <div className="code-coach-layer" role="presentation">
      <button className="code-coach-backdrop" type="button" aria-label="关闭代码教练" onClick={onClose} />
      <aside className="code-coach-panel" role="dialog" aria-modal="true" aria-labelledby="code-coach-title">
        <header>
          <div className="code-coach-heading">
            <span className="code-coach-badge" aria-hidden="true"><Sparkles size={16} /></span>
            <div>
              <p className="eyebrow">代码教练</p>
              <h2 id="code-coach-title">Python 写码指导</h2>
              <p>对着代码提问，教练会帮你找问题、给改法。</p>
            </div>
          </div>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="code-coach-presets">
          {INTENT_PRESETS.map((item) => {
            const Icon = item.icon;
            const debugLocked = item.id === "debug" && !hasRunError;
            return (
              <button
                key={item.id}
                type="button"
                className={pendingIntent === item.id ? "active" : ""}
                disabled={sending || debugLocked}
                title={debugLocked ? "请先运行代码并产生报错后再使用" : item.label}
                onClick={() => {
                  if (debugLocked) return;
                  setPendingIntent(item.id);
                  ask(item.question, item.id);
                }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <section className="code-coach-docs" aria-label="Python 指导文档">
          <header>
            <BookOpen size={14} />
            <strong>Python 函数库文档</strong>
          </header>
          <div className="code-coach-doc-links">
            {PYTHON_DOC_LINKS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                title={item.hint}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        <div className="code-coach-messages" ref={listRef}>
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`code-coach-bubble ${message.role}`}>
              <header className="code-coach-bubble-head">
                <span className="code-coach-avatar" aria-hidden="true">
                  {message.role === "user" ? <UserRound size={14} /> : <Code2 size={14} />}
                </span>
                <strong>{message.role === "user" ? "我" : "代码教练"}</strong>
              </header>
              {message.role === "assistant" ? (
                <CoachMarkdown text={message.text} />
              ) : (
                <p className="code-coach-user-text">{message.text}</p>
              )}
            </article>
          ))}
          {sending && (
            <article className="code-coach-bubble assistant">
              <header className="code-coach-bubble-head">
                <span className="code-coach-avatar" aria-hidden="true"><Code2 size={14} /></span>
                <strong>代码教练</strong>
              </header>
              <p className="code-coach-typing"><LoaderCircle className="spin-icon" size={14} /> 正在阅读你的代码…</p>
            </article>
          )}
        </div>

        {askError && <p className="form-error" role="alert">{askError}</p>}

        <form className="code-coach-composer" onSubmit={submit}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={session ? "例如：第 3 行报错是什么意思？怎么改循环？" : "登录后即可提问"}
            rows={3}
            disabled={sending || !session}
            maxLength={4000}
          />
          <button className="button primary" type="submit" disabled={sending || !session || !draft.trim()}>
            {sending ? <LoaderCircle className="spin-icon" size={16} /> : <Send size={16} />}
            发送
          </button>
        </form>
      </aside>
    </div>
  );
}
