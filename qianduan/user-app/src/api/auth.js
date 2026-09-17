import { api, AUTH_STORAGE_KEY } from "./client.js";

export function getStoredSession() {
  const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
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
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
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
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
