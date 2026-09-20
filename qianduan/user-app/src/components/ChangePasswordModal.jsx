import { Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { profileApi } from "../api/client.js";
import {
  PASSWORD_CHANGE_RULES_TEXT,
  passwordChangeHints,
  validatePasswordChangeFields,
} from "../utils/passwordValidation.js";

const EMPTY_FIELDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

function mapServerError(message) {
  const text = String(message || "").trim();
  if (!text) return { currentPassword: "密码修改失败，请稍后再试" };
  if (text.includes("当前密码")) return { currentPassword: "当前密码不正确" };
  if (text.includes("不能与当前密码相同")) return { newPassword: "新密码不能与当前密码相同" };
  if (text.includes("不一致")) return { confirmPassword: text };
  return { form: text };
}

export function ChangePasswordModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELDS);
  const [formError, setFormError] = useState("");
  const hints = passwordChangeHints(form);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function updateField(name, value) {
    const next = { ...form, [name]: value };
    setForm(next);
    setFormError("");
    if (touched[name] || name === "confirmPassword") {
      const nextErrors = validatePasswordChangeFields(next);
      setFieldErrors((current) => ({
        ...current,
        [name]: nextErrors[name],
        ...(name === "newPassword" || name === "confirmPassword"
          ? { confirmPassword: nextErrors.confirmPassword, newPassword: name === "newPassword" ? nextErrors.newPassword : current.newPassword }
          : {}),
        currentPassword: name === "currentPassword" ? nextErrors.currentPassword : (current.currentPassword?.includes("不正确") ? "" : current.currentPassword),
      }));
    }
  }

  function markTouched(name) {
    setTouched((current) => ({ ...current, [name]: true }));
    const nextErrors = validatePasswordChangeFields(form);
    setFieldErrors((current) => ({ ...current, [name]: nextErrors[name] }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ currentPassword: true, newPassword: true, confirmPassword: true });
    const nextErrors = validatePasswordChangeFields(form);
    setFieldErrors(nextErrors);
    setFormError("");
    if (nextErrors.currentPassword || nextErrors.newPassword || nextErrors.confirmPassword) {
      return;
    }
    setSubmitting(true);
    try {
      await profileApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      onSuccess?.("密码已更新");
      onClose?.();
    } catch (requestError) {
      const mapped = mapServerError(requestError.message);
      setFieldErrors((current) => ({ ...current, ...mapped, form: undefined }));
      setFormError(mapped.form || "");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop password-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="password-modal-title">修改登录密码</h2>
            <p>{PASSWORD_CHANGE_RULES_TEXT}</p>
          </div>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}><X size={19} /></button>
        </header>

        <form className="password-modal-form" onSubmit={handleSubmit} noValidate>
          {formError && <p className="page-error" role="alert">{formError}</p>}

          <label className={fieldErrors.currentPassword ? "has-error" : ""}>
            当前密码
            <span className="password-field">
              <input
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={form.currentPassword}
                maxLength={72}
                aria-invalid={Boolean(fieldErrors.currentPassword)}
                onBlur={() => markTouched("currentPassword")}
                onChange={(event) => updateField("currentPassword", event.target.value)}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowCurrent((v) => !v)} title={showCurrent ? "隐藏" : "显示"}>
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
            {fieldErrors.currentPassword && <small className="field-error" role="alert">{fieldErrors.currentPassword}</small>}
          </label>

          <label className={fieldErrors.newPassword ? "has-error" : ""}>
            新密码
            <span className="password-field">
              <input
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={form.newPassword}
                maxLength={72}
                aria-invalid={Boolean(fieldErrors.newPassword)}
                onBlur={() => markTouched("newPassword")}
                onChange={(event) => updateField("newPassword", event.target.value)}
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowNew((v) => !v)} title={showNew ? "隐藏" : "显示"}>
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
            {fieldErrors.newPassword && <small className="field-error" role="alert">{fieldErrors.newPassword}</small>}
          </label>

          <ul className="password-checklist" aria-label="密码要求">
            <li className={hints.lengthOk ? "ok" : ""}>8–72 位</li>
            <li className={hints.hasLetter ? "ok" : ""}>包含字母</li>
            <li className={hints.hasDigit ? "ok" : ""}>包含数字</li>
            <li className={hints.noSpace ? "ok" : ""}>不含空格</li>
            <li className={hints.differentFromCurrent ? "ok" : ""}>与当前密码不同</li>
            <li className={hints.confirmMatch ? "ok" : hints.confirmStarted ? "bad" : ""}>
              {hints.confirmMatch ? "两次密码一致" : "两次密码需一致"}
            </li>
          </ul>

          <label className={fieldErrors.confirmPassword ? "has-error" : ""}>
            确认新密码
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              maxLength={72}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              onBlur={() => markTouched("confirmPassword")}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              required
            />
            {fieldErrors.confirmPassword && <small className="field-error" role="alert">{fieldErrors.confirmPassword}</small>}
          </label>

          <div className="password-modal-actions">
            <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>取消</button>
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? <><LoaderCircle size={16} />提交中…</> : "确认修改"}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
