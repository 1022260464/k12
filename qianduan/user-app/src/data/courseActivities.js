import { TEACHING_TOPICS } from "./teachingTopics.js";

const PYTHON_EXAMPLES = new Set([
  "bubble-sort",
  "embedding-similarity",
  "rag-retrieval",
  "agent-tool-loop",
]);

/** 把服务端活动引用映射为站内动作；未知引用不会变成任意 URL。 */
export function resolveCourseActivity(activity) {
  if (!activity) return null;
  if (activity.activityType === "CAT_LESSON" && activity.referenceKey === "cat-recognition") {
    return { route: "cat-lesson" };
  }
  if (activity.activityType === "TEACHING_TOPIC") {
    const topic = TEACHING_TOPICS.find((item) => item.id === activity.referenceKey);
    if (!topic) return null;
    return {
      route: "ai-studio",
      draftRequest: { prompt: topic.prompt, topicId: topic.id, preferDeterministic: true },
    };
  }
  if (activity.activityType === "PYTHON_LAB" && PYTHON_EXAMPLES.has(activity.referenceKey)) {
    return { route: "code-lab", exampleId: activity.referenceKey };
  }
  return null;
}
