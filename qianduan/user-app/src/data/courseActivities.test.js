import assert from "node:assert/strict";
import test from "node:test";

import { resolveCourseActivity } from "./courseActivities.js";

test("正式课程活动只解析受控站内目标", () => {
  assert.deepEqual(resolveCourseActivity({ activityType: "CAT_LESSON", referenceKey: "cat-recognition" }), {
    route: "cat-lesson",
  });
  assert.equal(
    resolveCourseActivity({ activityType: "TEACHING_TOPIC", referenceKey: "rag-basics" }).draftRequest.topicId,
    "rag-basics",
  );
  assert.deepEqual(resolveCourseActivity({ activityType: "PYTHON_LAB", referenceKey: "agent-tool-loop" }), {
    route: "code-lab",
    exampleId: "agent-tool-loop",
  });
  assert.equal(resolveCourseActivity({ activityType: "PYTHON_LAB", referenceKey: "https://evil.test" }), null);
  assert.equal(resolveCourseActivity({ activityType: "LINK", referenceKey: "cat-recognition" }), null);
});
