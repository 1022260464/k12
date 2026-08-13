import { useState } from "react";

const EMPTY_FORM = { username: "", password: "", nickname: "", email: "", roleCode: "ROLE_STUDENT" };

export function UserForm({ user, roles, onCancel, onSubmit }) {
  const editing = Boolean(user);
  const [form, setForm] = useState(user ? {
    username: user.username,
    nickname: user.nickname || "",
    email: user.email || "",
    roleCode: user.roleCode || "ROLE_STUDENT",
  } : EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>用户名<input value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="用于登录，建议使用学号或工号" required /></label>
        <label>显示名称<input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} placeholder="例如：李老师" required /></label>
        <label className="wide">邮箱<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" /></label>
        {!editing && <label className="wide">初始密码<input type="password" minLength="8" maxLength="72" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="至少 8 位" required /></label>}
        <label className="wide">角色<select value={form.roleCode} onChange={(event) => update("roleCode", event.target.value)}>{roles.map((role) => <option key={role.code} value={role.code}>{role.name}（{role.code}）</option>)}</select></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-actions"><button className="button ghost" type="button" onClick={onCancel}>取消</button><button className="button primary" type="submit" disabled={submitting}>{submitting ? "正在保存..." : editing ? "保存修改" : "创建用户"}</button></footer>
    </form>
  );
}
