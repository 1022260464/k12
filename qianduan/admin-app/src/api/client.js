import {
  clearKnowledgeGraphOverviewCache,
  readKnowledgeGraphOverviewCache,
  writeKnowledgeGraphOverviewCache,
} from "../utils/knowledgeGraphCache.js";

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
      ...(fetchOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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
  students: () => api("/api/v1/iam/users/students"),
};

export const rolesApi = {
  list: () => api("/api/v1/iam/roles"),
  updatePermissions: (id, permissionCodes) => api(`/api/v1/iam/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionCodes }),
  }),
};

export const coursesApi = {
  importBatch: (file) => { const body = new FormData(); body.append("file", file); return api("/api/v1/learning/courses/import", { method: "POST", body }); },
  list: () => api("/api/v1/learning/courses"),
  page: (filters = {}) => api(`/api/v1/learning/courses/page?${query(filters)}`),
  get: (id) => api(`/api/v1/learning/courses/${id}`),
  create: (body) => api("/api/v1/learning/courses", { method: "POST", body: JSON.stringify(body) }),
  uploadCover: (id, file) => { const body = new FormData(); body.append("file", file); return api(`/api/v1/learning/courses/${id}/cover`, { method: "POST", body }); },
  uploadContentImage: (id, file) => { const body = new FormData(); body.append("file", file); return api(`/api/v1/learning/courses/${id}/content-images`, { method: "POST", body }); },
  publish: (id) => api(`/api/v1/learning/courses/${id}/publish`, { method: "POST" }),
  update: (id, body) => api(`/api/v1/learning/courses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => api(`/api/v1/learning/courses/${id}`, { method: "DELETE" }),
  chapters: (courseId) => api(`/api/v1/learning/courses/${courseId}/chapters`),
  chapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`),
  createChapter: (courseId, body) => api(`/api/v1/learning/courses/${courseId}/chapters`, { method: "POST", body: JSON.stringify(body) }),
  updateChapter: (courseId, chapterId, body) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`, { method: "PUT", body: JSON.stringify(body) }),
  removeChapter: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}`, { method: "DELETE" }),
  chapterCovers: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/covers`),
  replaceChapterCovers: async (courseId, chapterId, knowledgeCodes) => {
    const result = await api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/covers`, {
      method: "PUT",
      body: JSON.stringify({ knowledgeCodes }),
    });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  sections: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections`),
  section: (courseId, chapterId, sectionId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections/${sectionId}`),
  createSection: (courseId, chapterId, body) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections`, { method: "POST", body: JSON.stringify(body) }),
  updateSection: (courseId, chapterId, sectionId, body) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections/${sectionId}`, { method: "PUT", body: JSON.stringify(body) }),
  removeSection: (courseId, chapterId, sectionId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/sections/${sectionId}`, { method: "DELETE" }),
  attachments: (courseId) => api(`/api/v1/learning/courses/${courseId}/attachments`),
  chapterAttachments: (courseId, chapterId) => api(`/api/v1/learning/courses/${courseId}/chapters/${chapterId}/attachments`),
};

export const teachingResourcesApi = {
  page: (filters = {}) => api(`/api/v1/learning/teaching-resources?${query(filters)}`),
  get: (id) => api(`/api/v1/learning/teaching-resources/${id}`),
  upload: (metadata, file) => {
    const body = new FormData();
    body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    body.append("file", file);
    return api("/api/v1/learning/teaching-resources", { method: "POST", body });
  },
  update: (id, metadata) => api(`/api/v1/learning/teaching-resources/${id}`, { method: "PUT", body: JSON.stringify(metadata) }),
  submit: (id) => api(`/api/v1/learning/teaching-resources/${id}/submit`, { method: "POST" }),
  approve: (id, note) => api(`/api/v1/learning/teaching-resources/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  reject: (id, note) => api(`/api/v1/learning/teaching-resources/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  publish: (id) => api(`/api/v1/learning/teaching-resources/${id}/publish`, { method: "POST" }),
  index: (id) => api(`/api/v1/learning/teaching-resources/${id}/index`, { method: "POST" }),
  reindex: (id) => api(`/api/v1/learning/teaching-resources/${id}/reindex`, { method: "POST" }),
  syncGraph: (id) => api(`/api/v1/learning/teaching-resources/${id}/sync-graph`, { method: "POST" }),
  withdraw: (id) => api(`/api/v1/learning/teaching-resources/${id}/withdraw`, { method: "POST" }),
  download: (id) => api(`/api/v1/learning/teaching-resources/${id}/download-url`),
  events: (id) => api(`/api/v1/learning/teaching-resources/${id}/events`),
  reopen: (id) => api(`/api/v1/learning/teaching-resources/${id}/reopen`, { method: "POST" }),
};

export const knowledgeGraphApi = {
  status: () => api("/api/v1/learning/knowledge-graph/status"),
  overview: async ({ force = false } = {}) => {
    if (!force) {
      const cached = readKnowledgeGraphOverviewCache();
      if (cached) return cached;
    } else {
      clearKnowledgeGraphOverviewCache();
    }
    const data = await api(`/api/v1/learning/knowledge-graph/overview${force ? "?refresh=true" : ""}`);
    writeKnowledgeGraphOverviewCache(data);
    return data;
  },
  points: (filters = {}) => api(`/api/v1/learning/knowledge-graph/points?${query(filters)}`),
  suggestCovers: (body) => api("/api/v1/learning/knowledge-graph/suggest-covers", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  seed: async () => {
    const result = await api("/api/v1/learning/knowledge-graph/admin/seed", { method: "POST" });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  catalogInfo: () => api("/api/v1/learning/knowledge-graph/admin/catalog"),
  reloadCatalog: async () => {
    const result = await api("/api/v1/learning/knowledge-graph/admin/catalog/reload", { method: "POST" });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  syncCatalog: async ({ reload = true } = {}) => {
    const result = await api(
      `/api/v1/learning/knowledge-graph/admin/catalog/sync?reload=${reload ? "true" : "false"}`,
      { method: "POST" },
    );
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  purgeDirty: async () => {
    const result = await api("/api/v1/learning/knowledge-graph/admin/purge-dirty", { method: "POST" });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  dirtyStatus: () => api("/api/v1/learning/knowledge-graph/admin/dirty-status"),
  createPoint: async (body) => {
    const result = await api("/api/v1/learning/knowledge-graph/admin/points", {
      method: "POST",
      body: JSON.stringify(body),
    });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  updatePoint: async (code, body) => {
    const result = await api(`/api/v1/learning/knowledge-graph/admin/points/${encodeURIComponent(code)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  deletePoint: async (code, { force = false } = {}) => {
    const result = await api(
      `/api/v1/learning/knowledge-graph/admin/points/${encodeURIComponent(code)}?force=${force ? "true" : "false"}`,
      { method: "DELETE" },
    );
    clearKnowledgeGraphOverviewCache();
    return result;
  },
  reviewAlignment: (body) => api("/api/v1/learning/knowledge-graph/admin/review-alignment", {
    method: "POST",
    body: JSON.stringify(body),
  }),
  neighbors: (code) => api(`/api/v1/learning/knowledge-graph/points/${encodeURIComponent(code)}/neighbors`),
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
  importQuestions: (id, file) => { const body = new FormData(); body.append("file", file); return api(`/api/v1/assessments/homeworks/${id}/questions/import`, { method: "POST", body }); },
  questionAttachments: (id, questionId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments`),
  attachmentSummary: (id) => api(`/api/v1/assessments/homeworks/${id}/attachments/summary`),
  uploadQuestionAttachment: (id, questionId, file) => { const body = new FormData(); body.append("file", file); return api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments`, { method: "POST", body }); },
  deleteQuestionAttachment: (id, questionId, attachmentId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments/${attachmentId}`, { method: "DELETE" }),
  questionAttachmentUrl: (id, questionId, attachmentId) => api(`/api/v1/assessments/homeworks/${id}/questions/${questionId}/attachments/${attachmentId}/download-url`),
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
  returnSubmission: (id, body) => api(`/api/v1/assessments/homeworks/${id}/return`, { method: "POST", body: JSON.stringify(body) }),
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

export const profileApi = {
  getSelf: () => api("/api/v1/iam/users/me"),
  updateSelf: (body) => api("/api/v1/iam/users/me", { method: "PUT", body: JSON.stringify(body) }),
  uploadAvatar: (file) => {
    const body = new FormData();
    body.append("file", file);
    return api("/api/v1/iam/users/me/avatar", { method: "POST", body });
  },
  changePassword: (body) => api("/api/v1/iam/users/me/password", { method: "PUT", body: JSON.stringify(body) }),
};

export const healthApi = {
  all: () => Promise.allSettled([
    ["Gateway", "/api/v1/gateway/health"], ["IAM", "/api/v1/iam/health"], ["Learning", "/api/v1/learning/health"], ["Agent", "/api/v1/agents/health"], ["Assessment", "/api/v1/assessments/health"],
  ].map(async ([name, path]) => ({ name, data: await api(path, { public: true }) }))),
};
