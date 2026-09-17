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

const query = (values) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  });
  return params.toString();
};

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
  get: (id) => api(`/api/v1/iam/users/${id}`),
  create: (body) => api("/api/v1/iam/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/v1/iam/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/iam/users/${id}`, { method: "DELETE" }),
  updateStatus: (id, status) => api(`/api/v1/iam/users/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  resetPassword: (id, newPassword) => api(`/api/v1/iam/users/${id}/password`, { method: "PUT", body: JSON.stringify({ newPassword }) }),
  validateStudents: (userIds) => api("/api/v1/iam/users/students/validate", {
    method: "POST",
    body: JSON.stringify({ userIds }),
  }),
};

export const rolesApi = {
  list: () => api("/api/v1/iam/roles"),
  updatePermissions: (id, permissionCodes) => api(`/api/v1/iam/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionCodes }),
  }),
};

export const coursesApi = {
  list: () => api("/api/v1/learning/courses"),
  page: (filters = {}) => api(`/api/v1/learning/courses/page?${query(filters)}`),
  get: (id) => api(`/api/v1/learning/courses/${id}`),
  create: (body) => api("/api/v1/learning/courses", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/v1/learning/courses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/learning/courses/${id}`, { method: "DELETE" }),
  chapters: (courseId) => api(`/api/v1/learning/courses/${courseId}/chapters`),
  chapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`),
  createChapter: (courseId, body) => api(`/api/v1/learning/courses/${courseId}/chapters`, { method: "POST", body: JSON.stringify(body) }),
  updateChapter: (courseId, chapterId, body) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`, { method: "PUT", body: JSON.stringify(body) }),
  removeChapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`, { method: "DELETE" }),
};

export const agentsApi = {
  list: () => api("/api/v1/agents"),
  get: (id) => api(`/api/v1/agents/${id}`),
  create: (body) => api("/api/v1/agents", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/v1/agents/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/agents/${id}`, { method: "DELETE" }),
  run: (agentCode, body) => api(`/api/v1/agents/${agentCode}/runs`, { method: "POST", body: JSON.stringify(body) }),
  runs: (page = 1, size = 20) => api(`/api/v1/agents/runs?${query({ page, size })}`),
  runDetail: (runId) => api(`/api/v1/agents/runs/${runId}`),
  artifacts: (runId) => api(`/api/v1/agents/runs/${runId}/artifacts`),
  cancel: (runId) => api(`/api/v1/agents/runs/${runId}/cancel`, { method: "POST" }),
  retry: (runId) => api(`/api/v1/agents/runs/${runId}/retry`, { method: "POST" }),
};

export const homeworksApi = {
  list: (page = 1, size = 50) => api(`/api/v1/assessments/homeworks?${query({ page, size })}`),
  get: (id) => api(`/api/v1/assessments/homeworks/${id}`),
  create: (body) => api("/api/v1/assessments/homeworks", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/v1/assessments/homeworks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/assessments/homeworks/${id}`, { method: "DELETE" }),
  recipients: (id) => api(`/api/v1/assessments/homeworks/${id}/recipients`),
  setRecipients: (id, studentUserIds) => api(`/api/v1/assessments/homeworks/${id}/recipients`, { method: "PUT", body: JSON.stringify({ studentUserIds }) }),
  publish: (id) => api(`/api/v1/assessments/homeworks/${id}/publish`, { method: "POST" }),
  close: (id) => api(`/api/v1/assessments/homeworks/${id}/close`, { method: "POST" }),
  submissions: (id, page = 1, size = 20) => api(`/api/v1/assessments/homeworks/${id}/submissions?${query({ page, size })}`),
  submissionDetail: (id, studentId) => api(`/api/v1/assessments/homeworks/${id}/submissions/${studentId}/detail`),
  grade: (id, body) => api(`/api/v1/assessments/homeworks/${id}/grade`, { method: "POST", body: JSON.stringify(body) }),
  gradeHistory: (id, studentId) => api(`/api/v1/assessments/homeworks/${id}/submissions/${studentId}/grade-history`),
  questions: (id) => api(`/api/v1/assessments/homeworks/${id}/questions`),
  createQuestion: (id, body) => api(`/api/v1/assessments/homeworks/${id}/questions`, { method: "POST", body: JSON.stringify(body) }),
  updateQuestion: (id, questionId, body) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}`, { method: "PUT", body: JSON.stringify(body) }),
  removeQuestion: (id, questionId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}`, { method: "DELETE" }),
  gradeAnswer: (id, studentId, questionId, body) => api(`/api/v1/assessments/homeworks/${id}/submissions/${studentId}/answers/${questionId}/grade`, { method: "PUT", body: JSON.stringify(body) }),
};

export const auditsApi = {
  logins: (page = 1, size = 20) => api(`/api/v1/iam/audits/logins?${query({ page, size })}`),
  operations: (page = 1, size = 20) => api(`/api/v1/iam/audits/operations?${query({ page, size })}`),
};

export const healthApi = {
  all: () => Promise.allSettled([
    ["Gateway", "/api/v1/gateway/health"], ["IAM", "/api/v1/iam/health"], ["Learning", "/api/v1/learning/health"], ["Agent", "/api/v1/agents/health"], ["Assessment", "/api/v1/assessments/health"],
  ].map(async ([name, path]) => ({ name, data: await api(path, { public: true }) }))),
};
