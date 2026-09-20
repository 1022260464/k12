import { useState } from "react";
import {
  PASSWORD_RULES_TEXT,
  USERNAME_RULES_TEXT,
  mapUniqueIdentityError,
  passwordStrength,
  validateCreateUserForm,
} from "../utils/passwordValidation.js";

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
  const [fieldErrors, setFieldErrors] = useState({ username: "", email: "" });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: "" }));
    }
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({ username: "", email: "" });
    try {
      if (editing) {
        if (/[<>"'`\\]/.test(form.nickname || "")) {
          setError("显示名称不能包含特殊符号 < > \" ' ` \\");
          setSubmitting(false);
          return;
        }
      } else {
        const validationError = validateCreateUserForm(form);
        if (validationError) {
          if (validationError.includes("用户名")) {
            setFieldErrors({ username: validationError, email: "" });
          } else if (validationError.includes("邮箱")) {
            setFieldErrors({ username: "", email: validationError });
          } else {
            setError(validationError);
          }
          setSubmitting(false);
          return;
        }
      }
      await onSubmit(form);
    } catch (submitError) {
      const mapped = mapUniqueIdentityError(submitError.message);
      setFieldErrors(mapped.fields);
      setError(mapped.form);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>用户名
          <input
            value={form.username}
            minLength={4}
            maxLength={32}
            pattern="[A-Za-z][A-Za-z0-9_]{3,31}"
            title={USERNAME_RULES_TEXT}
            aria-invalid={Boolean(fieldErrors.username)}
            onChange={(event) => update("username", event.target.value)}
            placeholder="例如：teacher01"
            required
            disabled={editing}
          />
          {fieldErrors.username && <small className="field-error" role="alert">{fieldErrors.username}</small>}
        </label>
        <label>显示名称
          <input
            value={form.nickname}
            maxLength={64}
            onChange={(event) => update("nickname", event.target.value)}
            placeholder="例如：李老师"
            required
          />
        </label>
        <label className="wide">邮箱
          <input
            type="email"
            value={form.email}
            maxLength={128}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(event) => update("email", event.target.value)}
            placeholder="name@example.com"
          />
          {fieldErrors.email && <small className="field-error" role="alert">{fieldErrors.email}</small>}
        </label>
        {!editing && (
          <label className="wide">初始密码
            <input
              type="password"
              minLength={8}
              maxLength={72}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="至少8位，含字母和数字"
              required
            />
          </label>
        )}
        <label className="wide">角色
          <select value={form.roleCode} onChange={(event) => update("roleCode", event.target.value)}>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>{role.name}（{role.code}）</option>
            ))}
          </select>
        </label>
      </div>
      {!editing && (
        <ul className="password-checklist" aria-label="账号密码要求">
          <li className={/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(String(form.username || "").trim()) ? "ok" : ""}>账号合法</li>
          <li className={passwordStrength(form.password).lengthOk ? "ok" : ""}>密码 8–72 位</li>
          <li className={passwordStrength(form.password).hasLetter ? "ok" : ""}>含字母</li>
          <li className={passwordStrength(form.password).hasDigit ? "ok" : ""}>含数字</li>
        </ul>
      )}
      {!editing && <p className="muted form-hint">{USERNAME_RULES_TEXT}；{PASSWORD_RULES_TEXT}。</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="form-actions">
        <button className="button ghost" type="button" onClick={onCancel}>取消</button>
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "保存中..." : editing ? "保存修改" : "创建用户"}
        </button>
      </footer>
    </form>
  );
}
