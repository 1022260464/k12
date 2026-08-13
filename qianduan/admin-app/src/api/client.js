const SESSION_KEY = "k12-admin-session";

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function api(path, options = {}) {
  const session = getSession();
  const { public: publicRequest = false, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(!publicRequest && session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401) clearSession();
    const error = new Error(payload?.message || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return payload?.data;
}

export async function login(username, password) {
  const data = await api("/api/v1/iam/auth/login", {
    public: true,
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const session = { ...data, loggedAt: Date.now() };
  saveSession(session);
  return session;
}

export const usersApi = {
  list: () => api("/api/v1/iam/users"),
  create: (body) => api("/api/v1/iam/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/v1/iam/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/iam/users/${id}`, { method: "DELETE" }),
};

export const rolesApi = {
  list: () => api("/api/v1/iam/roles"),
  updatePermissions: (id, permissionCodes) => api(`/api/v1/iam/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionCodes }),
  }),
};
