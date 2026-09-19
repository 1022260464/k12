const ACTIONS = new Set(["compare", "swap", "probe", "found", "pass_complete", "complete"]);
const BAR_TYPES = new Set([
  "bubble-sort",
  "selection-sort",
  "insertion-sort",
  "linear-search",
  "binary-search",
]);

function expectedIndexCount(action) {
  if (action === "compare" || action === "swap") return 2;
  if (action === "probe" || action === "found") return 1;
  return 0;
}

export function normalizeBarSortAnimation(artifact) {
  if (artifact?.kind !== "ANIMATION" || artifact.mimeType !== "application/vnd.k12.animation.v1+json") return null;
  const payload = artifact.payload;
  if (payload?.schemaVersion !== "1.0" || !BAR_TYPES.has(payload.animationType)) return null;
  const values = payload.initialValues;
  const steps = payload.steps;
  if (!Array.isArray(values) || values.length < 2 || values.length > 8 ||
      !values.every((value) => Number.isInteger(value) && value >= 0 && value <= 100) ||
      !Array.isArray(steps) || steps.length < 1 || steps.length > 100) return null;
  if (typeof payload.title !== "string" || payload.title.length > 80) return null;
  if (!steps.every((step, index) =>
    step && step.step === index + 1 && ACTIONS.has(step.action) &&
    Array.isArray(step.values) && step.values.length === values.length &&
    step.values.every((value) => Number.isInteger(value) && value >= 0 && value <= 100) &&
    Array.isArray(step.indices) &&
    step.indices.length === expectedIndexCount(step.action) &&
    step.indices.every((position) => Number.isInteger(position) && position >= 0 && position < values.length) &&
    typeof step.narration === "string" && step.narration.length <= 300 &&
    (step.pass === null || (Number.isInteger(step.pass) && step.pass >= 1 && step.pass < values.length)))) return null;
  return {
    title: payload.title,
    animationType: payload.animationType,
    initialValues: values,
    steps,
  };
}

/** @deprecated 使用 normalizeBarSortAnimation */
export function normalizeBubbleSortAnimation(artifact) {
  const animation = normalizeBarSortAnimation(artifact);
  if (!animation || animation.animationType !== "bubble-sort") return null;
  return animation;
}
