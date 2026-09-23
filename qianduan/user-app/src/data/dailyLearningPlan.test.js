import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyLearningPlan } from "./dailyLearningPlan.js";

test("today plan prioritizes pending homework and explains prerequisite gaps", () => {
  const tasks = buildDailyLearningPlan({
    homeworks: [{ id: 9, status: "PUBLISHED", title: "图像分类作业", description: "完成三道分类题" }],
    submissions: [],
    mastery: [{ knowledgeCode: "ml.classification", topic: "图像分类", masteryPercent: 45 }],
    prerequisiteGaps: [{ code: "data.labels", title: "数据标签", masteryPercent: 30, weak: true }],
    history: [{ courseId: 2, courseTitle: "机器如何认识世界", progressPercent: 50 }],
  });

  assert.deepEqual(tasks.map((item) => item.type), ["HOMEWORK", "KNOWLEDGE", "COURSE"]);
  assert.match(tasks[1].detail, /数据标签/);
  assert.equal(tasks[2].route, "courses/2");
});

test("today plan falls back to a course discovery task for a new learner", () => {
  assert.deepEqual(buildDailyLearningPlan(), [{
    id: "explore-course",
    type: "COURSE",
    eyebrow: "第一步",
    title: "选择一门人工智能通识课程",
    detail: "完成一次课程学习或课堂小测后，系统会生成个性化任务。",
    actionLabel: "浏览课程",
    route: "courses",
  }]);
});

test("returned homework is surfaced as a revision task", () => {
  const [task] = buildDailyLearningPlan({
    homeworks: [{ id: 5, status: "PUBLISHED", title: "修改实验报告" }],
    submissions: [{ homeworkId: 5, status: "RETURNED" }],
  });
  assert.equal(task.eyebrow, "老师建议修改");
  assert.equal(task.actionLabel, "继续修改");
});
