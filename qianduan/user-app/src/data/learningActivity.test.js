import assert from "node:assert/strict";
import test from "node:test";
import { buildLearningActivity } from "./learningActivity.js";

test("buildLearningActivity only counts backend events within the latest seven days", () => {
  const summary = buildLearningActivity({
    history: [{ courseId: 1, courseTitle: "认识人工智能", progressPercent: 40, lastLearningTime: "2026-09-24T02:00:00Z" }],
    results: [{ id: 2, homeworkId: 3, homeworkTitle: "图片分类", status: "GRADED", score: 90, gradedTime: "2026-09-22T02:00:00Z" }],
    attempts: [{ id: 4, topic: "训练数据", scorePercent: 80, createdTime: "2026-09-10T02:00:00Z" }],
  }, new Date("2026-09-24T12:00:00+08:00"));

  assert.equal(summary.events.length, 3);
  assert.equal(summary.weeklyEvents, 2);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.todayEvents, 1);
  assert.equal(summary.latest.type, "COURSE");
});

test("buildLearningActivity prefers append-only server events when available", () => {
  const summary = buildLearningActivity({
    events: [{ id: 10, eventType: "HOMEWORK_SUBMITTED", sourceType: "HOMEWORK", sourceId: "3", title: "图片分类", detail: "已提交作业", occurredTime: "2026-09-24T02:00:00Z" }],
    history: [{ courseId: 1, courseTitle: "旧汇总", progressPercent: 40, lastLearningTime: "2026-09-23T02:00:00Z" }],
  }, new Date("2026-09-24T12:00:00+08:00"));

  assert.equal(summary.events.length, 1);
  assert.equal(summary.latest.route, "tasks/3");
  assert.equal(summary.todayEvents, 1);
});
