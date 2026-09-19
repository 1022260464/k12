export function normalizeTeachingSteps(artifact) {
  if (artifact?.kind !== "ANIMATION" || artifact.mimeType !== "application/vnd.k12.lesson-steps.v1+json") return null;
  const payload = artifact.payload;
  if (payload?.schemaVersion !== "1.0" || payload.animationType !== "lesson-steps") return null;
  const { title, learningGoal, steps } = payload;
  if (typeof title !== "string" || !title.trim() || title.length > 80 ||
      typeof learningGoal !== "string" || !learningGoal.trim() || learningGoal.length > 200 ||
      !Array.isArray(steps) || steps.length < 2 || steps.length > 6) return null;
  if (!steps.every((step, index) =>
    step?.number === index + 1 &&
    typeof step.label === "string" && step.label.trim() && step.label.length <= 80 &&
    typeof step.detail === "string" && step.detail.trim() && step.detail.length <= 300)) return null;
  return { title, learningGoal, steps };
}
