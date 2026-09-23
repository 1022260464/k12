import assert from "node:assert/strict";
import test from "node:test";
import {
  topicCodeForId,
  topicIdForKnowledgeCode,
  topicsByCategory,
} from "./teachingTopics.js";

test("小学目录展示独立绘本且隐藏高中系统主题", () => {
  const groups = topicsByCategory("primary");
  const topicIds = groups.flatMap((group) => group.topics.map((topic) => topic.id));

  assert.ok(topicIds.includes("cat-picture-book"));
  assert.ok(!topicIds.includes("rag-basics"));
});

test("初高中目录隐藏低龄绘本且展示系统主题", () => {
  const groups = topicsByCategory("teen");
  const topicIds = groups.flatMap((group) => group.topics.map((topic) => topic.id));

  assert.ok(!topicIds.includes("cat-picture-book"));
  assert.ok(topicIds.includes("rag-basics"));
});

test("下一课使用稳定知识点编码双向映射", () => {
  assert.equal(topicCodeForId("object-detection"), "computer_vision.object_detection");
  assert.equal(topicIdForKnowledgeCode("computer_vision.object_detection"), "object-detection");
});
