import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getStoredSession, login, logout, register } from "./api/auth.js";
import { FloatingAssistant } from "./components/FloatingAssistant.jsx";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { CoursesPage } from "./pages/CoursesPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { ProgressPage } from "./pages/ProgressPage.jsx";
import { TasksPage } from "./pages/TasksPage.jsx";

const validPages = new Set(["home", "courses", "tasks", "progress"]);

function pageFromHash() {
  const page = window.location.hash.replace(/^#\/?/, "") || "home";
  return validPages.has(page) ? page : "home";
}

function AuthDialog({ initialMode = "login", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: "", password: "", nickname: "", email: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        await register({
          username: form.username.trim(),
          password: form.password,
          nickname: form.nickname.trim(),
          email: form.email.trim() || null,
        });
      }
      onSuccess(await login(form.username.trim(), form.password));
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog-close" type="button" title="关闭" onClick={onClose}><X size={19} /></button>
        <div className="dialog-brand"><span>eg</span></div>
        <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建学习账号"}</p>
        <h2 id="login-title">{mode === "login" ? "登录学习空间" : "注册学生账号"}</h2>
        <p className="dialog-note">{mode === "login" ? "登录后同步课程、作业和学习记录。" : "新账号将自动获得学生角色。"}</p>
        <form onSubmit={handleSubmit}>
          <label>用户名<input autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="请输入用户名" required /></label>
          {mode === "register" && <label>姓名或昵称<input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如：小明" required /></label>}
          {mode === "register" && <label>邮箱（选填）<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></label>}
          <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="请输入密码" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={submitting}>{submitting ? "正在提交..." : mode === "login" ? "登录" : "注册并登录"}</button>
        </form>
        <button className="account-switch" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "没有账号？注册学生账号" : "已有账号？返回登录"}</button>
      </section>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(getStoredSession);
  const [page, setPage] = useState(pageFromHash);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const displayName = useMemo(() => session?.user?.username ?? "同学", [session]);

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigate(nextPage) {
    window.location.hash = `#${nextPage}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setShowLogin(true);
  }

  function requireLogin(action) {
    if (session) action?.();
    else openAuth("login");
  }

  const pages = {
    home: <HomePage session={session} displayName={displayName} navigate={navigate} requireLogin={requireLogin} />,
    courses: <CoursesPage session={session} requireLogin={requireLogin} />,
    tasks: <TasksPage session={session} requireLogin={requireLogin} />,
    progress: <ProgressPage session={session} requireLogin={requireLogin} />,
  };

  return (
    <main>
      <SiteHeader page={page} session={session} displayName={displayName} navigate={navigate} onLogin={() => openAuth("login")} onRegister={() => openAuth("register")} onLogout={() => { logout(); setSession(null); }} />
      {pages[page]}
      <footer className="site-footer"><button className="brand brand-button" type="button" onClick={() => navigate("home")}><span className="brand-mark">eg</span><span>EduGraph AI</span></button><p>面向 K12 的多智能体教学平台</p><span>© 2026 K12 Platform</span></footer>
      <FloatingAssistant session={session} displayName={displayName} onRequireLogin={() => openAuth("login")} />
      {showLogin && <AuthDialog initialMode={authMode} onClose={() => setShowLogin(false)} onSuccess={(nextSession) => { setSession(nextSession); setShowLogin(false); }} />}
    </main>
  );
}
