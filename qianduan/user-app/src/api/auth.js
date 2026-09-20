import { api, AUTH_STORAGE_KEY } from "./client.js";

function readRawSession() {
  const fromLocal = localStorage.getItem(AUTH_STORAGE_KEY);
  if (fromLocal) return fromLocal;
  // 兼容旧版 sessionStorage：迁移到 localStorage，便于新标签页共享登录态
  const fromSession = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (fromSession) {
    localStorage.setItem(AUTH_STORAGE_KEY, fromSession);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }
  return fromSession;
}

export function getStoredSession() {
  const raw = readRawSession();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export async function login(username, password) {
  const data = await api("/api/v1/iam/auth/login", {
    public: true,
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const session = { ...data, user: { username: data.username, authorities: data.authorities } };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  return session;
}

export async function register(form) {
  return api("/api/v1/iam/auth/register", {
    public: true,
    method: "POST",
    body: JSON.stringify(form),
  });
}

export function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
