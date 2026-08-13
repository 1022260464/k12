const AUTH_STORAGE_KEY = "k12-user-auth";

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

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `请求失败（${response.status}）`);
  return payload?.data;
}

export async function login(username, password) {
  const data = await request("/api/v1/iam/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const session = { ...data, user: { username: data.username, authorities: data.authorities } };
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function register(form) {
  return request("/api/v1/iam/auth/register", {
    method: "POST",
    body: JSON.stringify(form),
  });
}

export function logout() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
