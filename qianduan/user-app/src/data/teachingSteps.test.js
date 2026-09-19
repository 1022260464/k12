import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeachingSteps } from "./teachingSteps.js";

const artifact = {
  kind: "ANIMATION",
  mimeType: "application/vnd.k12.lesson-steps.v1+json",
  payload: {
    schemaVersion: "1.0",
    animationType: "lesson-steps",
    title: "神经网络·逐步理解",
    learningGoal: "理解输入与输出",
    steps: [
      { number: 1, label: "输入", detail: "观察图片输入" },
      { number: 2, label: "输出", detail: "比较类别结果" },
    ],
  },
};

test("accepts bounded, versioned lesson steps", () => {
  assert.equal(normalizeTeachingSteps(artifact)?.steps.length, 2);
});

test("rejects HTML and unsupported animation MIME", () => {
  assert.equal(normalizeTeachingSteps({ ...artifact, mimeType: "text/html" }), null);
  assert.equal(normalizeTeachingSteps({ ...artifact, payload: { ...artifact.payload, steps: Array(7).fill(artifact.payload.steps[0]) } }), null);
});
