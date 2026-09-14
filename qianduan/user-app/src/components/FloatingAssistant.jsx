import { Bot, ChevronDown, MessageSquareText, Send, X } from "lucide-react";
import { useState } from "react";
import { agentsApi } from "../api/client.js";

export function FloatingAssistant({ session, displayName, onRequireLogin }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState([{ role: "assistant", text: "你好，我是你的 AI 学习助教。今天想复习哪个知识点？" }]);

  async function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    if (!session) { onRequireLogin(); return; }
    setQuestion("");
    setError("");
    setConversation((current) => [...current, { role: "user", text }]);
    setSending(true);
    try {
      const run = await agentsApi.run("study-plan", { inputText: text, sessionId: `web-${Date.now()}`, executionMode: "SYNC", context: { source: "user-web" } });
      setConversation((current) => [...current, { role: "assistant", text: run.outputText || "任务已提交，请稍后在运行记录中查看结果。" }]);
    } catch (requestError) {
      setError(requestError.message);
      setConversation((current) => [...current, { role: "assistant", text: "暂时无法连接 AI 服务，请稍后重试。" }]);
    } finally { setSending(false); }
  }

  return (
    <aside className={`floating-assistant ${open ? "open" : ""}`} aria-label="AI 学习助教">
      {open ? <section className="assistant-window assistant-popover">
        <header><span className="assistant-avatar"><Bot size={19} /></span><div><strong>AI 学习助教</strong><small><i />{sending ? "思考中" : "在线"}</small></div><button className="assistant-control" type="button" title="收起" onClick={() => setOpen(false)}><ChevronDown size={19} /></button><button className="assistant-control" type="button" title="关闭" onClick={() => setOpen(false)}><X size={18} /></button></header>
        <div className="conversation" aria-live="polite">{conversation.slice(-6).map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Bot size={16} /> : displayName.slice(0, 1)}</span><p>{message.text}</p></div>)}</div>
        {error && <p className="assistant-error">{error}</p>}
        <form className="assistant-input" onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入问题，按 Enter 发送" aria-label="向 AI 助教提问" /><button className="send-button" type="submit" title="发送问题" disabled={sending}><Send size={17} /></button></form>
        <footer>AI 回答仅供学习参考</footer>
      </section> : <button className="assistant-launcher" type="button" aria-label="打开 AI 学习助教" data-label="问 AI 助教" onClick={() => setOpen(true)}><MessageSquareText size={22} /></button>}
    </aside>
  );
}
