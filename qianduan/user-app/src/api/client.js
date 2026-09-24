import { readKnowledgeGraphOverviewCache, writeKnowledgeGraphOverviewCache } from "../utils/knowledgeGraphCache.js";

const AUTH_STORAGE_KEY = "k12-user-auth";

function readAuthRaw() {
  return localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
}

function clearAuthRaw() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function api(path, options = {}) {
  const session = JSON.parse(readAuthRaw() || "null");
  const { public: publicRequest = false, headers, ...requestOptions } = options;
  const response = await fetch(path, {
    ...requestOptions,
    headers: {
      ...(requestOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(!publicRequest && session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearAuthRaw();
    const error = new Error(friendlyRequestMessage(response.status, payload?.message));
    error.status = response.status;
    throw error;
  }
  return payload?.data;
}

async function apiBlob(path, options = {}) {
  const session = JSON.parse(readAuthRaw() || "null");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) clearAuthRaw();
    const payload = await response.json().catch(() => null);
    const error = new Error(friendlyRequestMessage(response.status, payload?.message));
    error.status = response.status;
    throw error;
  }
  return {
    blob: await response.blob(),
    model: response.headers.get("X-Speech-Model"),
    voice: response.headers.get("X-Speech-Voice"),
  };
}

/** 学生端展示用：去掉 HTTP 状态码与技术异常原文 */
function friendlyRequestMessage(status, payloadMessage) {
  const raw = String(payloadMessage || "").trim();
  const hasChinese = /[\u4e00-\u9fff]/.test(raw);
  const looksTechnical = !raw
    || /^(null|undefined|error|exception|internal|unauthorized|forbidden)$/i.test(raw)
    || (!hasChinese && /\b(HTTP|SQL|Neo4j|Redis|MinIO|pgvector|stack|trace|Exception|NullPointer)\b/i.test(raw))
    || /^\d{3}\b/.test(raw)
    || /请求失败（\d+）/.test(raw);
  if (raw && !looksTechnical) return raw;
  if (status === 401) return "登录已过期，请重新登录";
  if (status === 403) return "暂无权限进行此操作";
  if (status === 404) return "未找到相关内容，请返回重试";
  if (status === 429) return "操作太频繁，请稍后再试";
  if (status === 503) return "头像暂时无法上传，请稍后再试";
  if (status >= 500) return "服务暂时不可用，请稍后再试";
  return "暂时无法完成操作，请稍后再试";
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
  getSelf: () => api("/api/v1/iam/users/me"),
  updateSelf: (body) => api("/api/v1/iam/users/me", { method: "PUT", body: JSON.stringify(body) }),
  uploadAvatar: (file) => {
    const body = new FormData();
    body.append("file", file);
    return api("/api/v1/iam/users/me/avatar", { method: "POST", body });
  },
  getLearningProfile: () => api("/api/v1/iam/users/me/learning-profile"),
  updateLearningProfile: (body) => api("/api/v1/iam/users/me/learning-profile", { method: "PUT", body: JSON.stringify(body) }),
  changePassword: (body) => api("/api/v1/iam/users/me/password", { method: "PUT", body: JSON.stringify(body) }),
  tokenState: () => api("/api/v1/iam/auth/token-state"),
};

export const coursesApi = {
  attachments: (courseId) => api(`/api/v1/learning/courses/${courseId}/attachments`),
  chapterAttachments: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/attachments`),
  list: () => api("/api/v1/learning/courses"),
  recommended: (limit = 8) => api(`/api/v1/learning/courses/recommended?${query({ limit })}`),
  personalized: (mastery, limit = 6) => api("/api/v1/learning/courses/personalized", {
    method: "POST",
    body: JSON.stringify({ mastery, limit }),
  }),
  page: (filters = {}) => api(`/api/v1/learning/courses/page?${query(filters)}`),
  history: (limit = 10) => api(`/api/v1/learning/history/me?${query({ limit })}`),
  events: (days = 30, limit = 100) => api(`/api/v1/learning/events/me?${query({ days, limit })}`),
  get: (id) => api(`/api/v1/learning/courses/${id}`),
  chapters: (courseId) => api(`/api/v1/learning/courses/${courseId}/chapters`),
  chapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`),
  sections: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections`),
  section: (courseId, chapterId, sectionId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections/${sectionId}`),
  sectionActivities: (courseId, chapterId, sectionId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections/${sectionId}/activities`),
  enrollment: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`),
  enroll: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`, { method: "PUT" }),
  withdraw: (courseId) => api(`/api/v1/learning/courses/${courseId}/enrollment`, { method: "DELETE" }),
  progress: (courseId) => api(`/api/v1/learning/courses/${courseId}/progress`),
  updateProgress: (courseId, chapterId, progressPercent) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/progress`, { method: "PUT", body: JSON.stringify({ progressPercent }) }),
};

export const pictureBooksApi = {
  published: () => api("/api/v1/learning/picture-books/published", { public: true }),
  getPublished: (bookCode) => api(`/api/v1/learning/picture-books/published/${encodeURIComponent(bookCode)}`, { public: true }),
};

export const teachingResourcesApi = {
  published: (filters = {}) => api(`/api/v1/learning/teaching-resources/published?${query(filters)}`),
  publishedGet: (id) => api(`/api/v1/learning/teaching-resources/published/${id}`),
  publishedDownload: (id) => api(`/api/v1/learning/teaching-resources/published/${id}/download-url`),
};

export const leaderboardApi = {
  get: (limit = 20) => api(`/api/v1/learning/leaderboard?${query({ limit })}`),
};

export const visualProgrammingApi = {
  missions: () => api("/api/v1/learning/visual-programming/missions/published", { public: true }),
  mission: (missionCode) => api(`/api/v1/learning/visual-programming/missions/published/${encodeURIComponent(missionCode)}`, { public: true }),
  mine: () => api("/api/v1/learning/visual-programming/projects/me"),
  save: (missionCode, workspace) => api(
    `/api/v1/learning/visual-programming/projects/${encodeURIComponent(missionCode)}`,
    { method: "PUT", body: JSON.stringify({ workspace }) },
  ),
};

export const homeworksApi = {
  questionAttachments: (id, questionId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments`),
  questionAttachmentUrl: (id, questionId, attachmentId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments/${attachmentId}/download-url`),
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

export const knowledgeGraphApi = {
  overview: async ({ force = false } = {}) => {
    if (!force) {
      const cached = readKnowledgeGraphOverviewCache();
      if (cached) return cached;
    }
    const data = await api("/api/v1/learning/knowledge-graph/overview");
    writeKnowledgeGraphOverviewCache(data);
    return data;
  },
  points: (filters = {}) => api(`/api/v1/learning/knowledge-graph/points?${query(filters)}`),
  prerequisiteGaps: (code, mastery = []) => {
    const params = new URLSearchParams();
    mastery.forEach((item) => {
      if (!item?.knowledgeCode || item.masteryPercent == null) return;
      params.append("mastery", `${item.knowledgeCode}:${item.masteryPercent}`);
    });
    const suffix = params.toString();
    return api(`/api/v1/learning/knowledge-graph/points/${encodeURIComponent(code)}/prerequisite-gaps${suffix ? `?${suffix}` : ""}`);
  },
  recommendNext: (body) => api("/api/v1/learning/knowledge-graph/recommendations/next", {
    method: "POST",
    body: JSON.stringify(body),
  }),
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

export const speechApi = {
  synthesize: (text) => apiBlob("/api/v1/agents/speech/synthesize", {
    method: "POST",
    body: JSON.stringify({ text }),
  }),
};

export { AUTH_STORAGE_KEY };
