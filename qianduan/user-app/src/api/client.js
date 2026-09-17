const AUTH_STORAGE_KEY = "k12-user-auth";

export async function api(path, options = {}) {
  const session = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || "null");
  const { public: publicRequest = false, headers, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(!publicRequest && session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) sessionStorage.removeItem(AUTH_STORAGE_KEY);
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

export const profileApi = {
  me: () => api("/api/v1/iam/me"),
  getLearningProfile: () => api("/api/v1/iam/users/me/learning-profile"),
  updateLearningProfile: (body) => api("/api/v1/iam/users/me/learning-profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body) => api("/api/v1/iam/users/me/password", { method: "PUT", body: JSON.stringify(body) }),
  tokenState: () => api("/api/v1/iam/auth/token-state"),
};

export const coursesApi = {
  list: () => api("/api/v1/learning/courses"),
  page: (filters = {}) => api(`/api/v1/learning/courses/page?${query(filters)}`),
  history: (limit = 10) => api(`/api/v1/learning/history/me?${query({ limit })}`),
  get: (id) => api(`/api/v1/learning/courses/${id}`),
  chapters: (courseId) => api(`/api/v1/learning/courses/${courseId}/chapters`),
  chapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`),
  enrollment: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`),
  enroll: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`, { method: "PUT" }),
  withdraw: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`, { method: "DELETE" }),
  progress: (courseId) => api(`/api/v1/learning/courses/${courseId}/progress`),
  updateProgress: (courseId, chapterId, progressPercent) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/progress`, { method: "PUT", body: JSON.stringify({ progressPercent }) }),
};

export const leaderboardApi = {
  get: (limit = 20) => api(`/api/v1/learning/leaderboard?${query({ limit })}`),
};

export const homeworksApi = {
  list: (page = 1, size = 20) => api(`/api/v1/assessments/homeworks?${query({ page, size })}`),
  get: (id) => api(`/api/v1/assessments/homeworks/${id}`),
  questions: (id) => api(`/api/v1/assessments/homeworks/${id}/questions`),
  mySubmission: (id) => api(`/api/v1/assessments/homeworks/${id}/submissions/me`),
  mySubmissionDetail: (id) => api(`/api/v1/assessments/homeworks/${id}/submissions/me/detail`),
  submit: (id, body) => api(`/api/v1/assessments/homeworks/${id}/submit`, { method: "POST", body: JSON.stringify(body) }),
  learningResults: (page = 1, size = 20) => api(`/api/v1/assessments/homeworks/learning-results/me?${query({ page, size })}`),
};

export const practiceApi = {
  submit: (body) => api("/api/v1/assessments/practice-attempts", { method: "POST", body: JSON.stringify(body) }),
  byRun: (runId) => api(`/api/v1/assessments/practice-attempts/runs/${encodeURIComponent(runId)}/me`),
  recent: (limit = 5) => api(`/api/v1/assessments/practice-attempts/me?${query({ limit })}`),
  insights: () => api("/api/v1/assessments/practice-attempts/me/insights"),
  mastery: () => api("/api/v1/assessments/practice-attempts/me/mastery"),
};

export const agentsApi = {
  list: () => api("/api/v1/agents"),
  run: (agentCode, body) => api(`/api/v1/agents/${agentCode}/runs`, { method: "POST", body: JSON.stringify(body) }),
  executeCode: (body) => api("/api/v1/agents/code-executions", { method: "POST", body: JSON.stringify(body) }),
  sessionHistory: (agentCode, sessionId, limit = 20) => api(`/api/v1/agents/${agentCode}/sessions/${encodeURIComponent(sessionId)}/history?${query({ limit })}`),
  runs: (page = 1, size = 20) => api(`/api/v1/agents/runs?${query({ page, size })}`),
  runDetail: (runId) => api(`/api/v1/agents/runs/${runId}`),
  artifacts: (runId) => api(`/api/v1/agents/runs/${runId}/artifacts`),
  artifactDownloadUrl: (runId, artifactId) => api(
    `/api/v1/agents/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactId)}/download-url`,
  ),
  cancel: (runId) => api(`/api/v1/agents/runs/${runId}/cancel`, { method: "POST" }),
  retry: (runId) => api(`/api/v1/agents/runs/${runId}/retry`, { method: "POST" }),
};

export { AUTH_STORAGE_KEY };
