import { useState } from "react";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { clearSession, login } from "../api/client.js";

export function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const session = await login(form.username.trim(), form.password);
      if (!session.authorities?.includes("ROLE_ADMIN")) {
        clearSession();
        throw new Error("当前账号没有管理员权限");
      }
      onLogin(session);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-context">
        <a className="brand" href="/"><span className="brand-mark">eg</span><span>EduGraph AI</span></a>
        <div className="context-copy"><p className="eyebrow">K12 PLATFORM CONSOLE</p><h1>管理教学平台的账号与访问边界</h1><p>统一维护学生、教师与管理员身份，确保每个账号只访问被授权的资源。</p></div>
        <div className="security-note"><ShieldCheck size={22} /><div><strong>基于 JWT 与 RBAC</strong><span>登录身份、角色和接口权限由后端统一校验</span></div></div>
      </section>
      <section className="login-panel"><div className="login-box"><div className="login-icon"><KeyRound size={24} /></div><p className="eyebrow">管理端登录</p><h2>进入平台控制台</h2><p className="muted">仅限已分配管理员角色的账号访问。</p><form onSubmit={handleSubmit}><label>用户名<input autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required /></label><label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="请输入密码" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary login-submit" type="submit" disabled={submitting}>{submitting ? "正在验证..." : "登录控制台"}<ArrowRight size={18} /></button></form><p className="login-help">账号异常请联系平台系统负责人。</p></div></section>
    </main>
  );
}
