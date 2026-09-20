const CACHE_KEY = "k12-kg-overview-cache-v3";
const CACHE_TTL_MS = 10 * 60 * 1000;

/** 图谱总览相对固定：浏览器会话内复用，避免每次进页都空等异步加载。 */
export function readKnowledgeGraphOverviewCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || !parsed?.data) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeKnowledgeGraphOverviewCache(data) {
  if (!data) return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // quota / private mode
  }
}

export function clearKnowledgeGraphOverviewCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
