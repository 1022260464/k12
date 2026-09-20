const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)\S{8,72}$/;

/** 登录账号：4–32 位，字母开头，仅字母/数字/下划线。 */
export function validateUsername(username) {
  const value = String(username || "").trim();
  if (!value) return "请输入用户名";
  if (value.length < 4 || value.length > 32) return "用户名需为 4–32 位";
  if (/\s/.test(value)) return "用户名不能包含空格";
  if (!USERNAME_PATTERN.test(value)) {
    return "用户名需以字母开头，仅可用字母、数字和下划线";
  }
  return "";
}

/** 与后端密码规则对齐。 */
export function validateNewPassword(password, { currentPassword, label = "密码" } = {}) {
  const value = String(password || "");
  if (!value) return `请输入${label}`;
  if (value.length < PASSWORD_MIN) return `${label}至少 ${PASSWORD_MIN} 位`;
  if (value.length > PASSWORD_MAX) return `${label}最多 ${PASSWORD_MAX} 位`;
  if (/\s/.test(value)) return `${label}不能包含空格`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return `${label}需同时包含字母和数字`;
  if (!PASSWORD_PATTERN.test(value)) return `${label}含有非法字符`;
  if (currentPassword && value === currentPassword) return "新密码不能与当前密码相同";
  return "";
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!String(currentPassword || "").trim()) return "请输入当前密码";
  const newError = validateNewPassword(newPassword, { currentPassword, label: "新密码" });
  if (newError) return newError;
  if (!confirmPassword) return "请再次输入新密码";
  if (newPassword !== confirmPassword) return "两次输入的新密码不一致";
  return "";
}

/** 字段级校验，便于输入框下方即时提示。 */
export function validatePasswordChangeFields({ currentPassword, newPassword, confirmPassword }) {
  const fields = { currentPassword: "", newPassword: "", confirmPassword: "" };
  if (!String(currentPassword || "").trim()) {
    fields.currentPassword = "请输入当前密码";
  }
  fields.newPassword = validateNewPassword(newPassword, { currentPassword, label: "新密码" });
  if (!confirmPassword) {
    fields.confirmPassword = "请再次输入新密码";
  } else if (newPassword && confirmPassword !== newPassword) {
    fields.confirmPassword = "两次输入的新密码不一致";
  }
  return fields;
}

export function passwordChangeHints({ currentPassword, newPassword, confirmPassword }) {
  const hasConfirm = String(confirmPassword || "").length > 0;
  return {
    ...passwordStrength(newPassword),
    differentFromCurrent: Boolean(newPassword)
      && Boolean(currentPassword)
      && newPassword !== currentPassword,
    confirmMatch: hasConfirm && Boolean(newPassword) && newPassword === confirmPassword,
    confirmStarted: hasConfirm,
  };
}

export function validateRegisterForm({ username, password, nickname, email }) {
  const usernameError = validateUsername(username);
  if (usernameError) return usernameError;
  if (!String(nickname || "").trim()) return "请输入姓名或昵称";
  if (String(nickname || "").trim().length > 64) return "昵称最多 64 个字符";
  if (/[<>"'`\\]/.test(nickname || "")) return "昵称不能包含特殊符号 < > \" ' ` \\";
  const emailValue = String(email || "").trim();
  if (emailValue) {
    if (emailValue.length > 128) return "邮箱过长";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return "邮箱格式不正确";
  }
  return validateNewPassword(password, { label: "密码" });
}

export function passwordStrength(password) {
  const value = String(password || "");
  return {
    lengthOk: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    hasLetter: /[A-Za-z]/.test(value),
    hasDigit: /\d/.test(value),
    noSpace: value.length > 0 && !/\s/.test(value),
  };
}

export const USERNAME_RULES_TEXT = "用户名 4–32 位，字母开头，仅字母/数字/下划线";
export const PASSWORD_RULES_TEXT = `密码需 ${PASSWORD_MIN}-${PASSWORD_MAX} 位，同时包含字母和数字，不能含空格`;
export const PASSWORD_CHANGE_RULES_TEXT = `${PASSWORD_RULES_TEXT}，且不能与当前密码相同。`;
