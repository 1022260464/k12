import assert from "node:assert/strict";
import test from "node:test";
import { evaluateBlocklyMission } from "./blocklyMissions.js";

test("数据标注关卡要求正确标签和成功训练", () => {
  const result = evaluateBlocklyMission("label-training-data", [
    { type: "LABEL", imageId: "cat-1", category: "cat" },
    { type: "LABEL", imageId: "cat-2", category: "cat" },
    { type: "LABEL", imageId: "dog-1", category: "dog" },
    { type: "LABEL", imageId: "dog-2", category: "dog" },
    { type: "TRAIN", success: true },
  ]);

  assert.equal(result.passed, true);
  assert.equal(result.stars, 3);
});

test("预测关卡缺少条件判断时不能通过", () => {
  const result = evaluateBlocklyMission("predict-and-decide", [
    { type: "TRAIN", success: true },
    { type: "PREDICT", imageId: "mystery-cat", prediction: "cat" },
  ]);

  assert.equal(result.passed, false);
  assert.equal(result.stars, 2);
});

test("循环关卡按累计移动距离判定", () => {
  const result = evaluateBlocklyMission("repeat-a-route", [
    { type: "REPEAT", times: 4 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "SAY", message: "任务完成" },
  ]);

  assert.equal(result.passed, true);
  assert.equal(result.stars, 3);
});

test("置信度关卡要求设置门槛后再回答", () => {
  const result = evaluateBlocklyMission("confidence-gate", [
    { type: "TRAIN", success: true },
    { type: "PREDICT", imageId: "mystery-cat", prediction: "cat", confidence: 92 },
    { type: "CONFIDENCE_CONDITION", threshold: 80, matched: true },
    { type: "SAY", message: "我很有把握" },
  ]);

  assert.equal(result.passed, true);
  assert.equal(result.stars, 3);
});

test("综合巡检关卡要求完成感知判断和行动", () => {
  const result = evaluateBlocklyMission("campus-ai-patrol", [
    { type: "TRAIN", success: true },
    { type: "PREDICT", imageId: "mystery-dog", prediction: "dog", confidence: 88 },
    { type: "CONDITION", expected: "dog", matched: true },
    { type: "REPEAT", times: 4 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "MOVE", steps: 2 },
    { type: "SAY", message: "巡检完成" },
  ]);

  assert.equal(result.passed, true);
  assert.equal(result.stars, 3);
});

test("数据均衡关卡要求样本数量一致并解释公平性", () => {
  const result = evaluateBlocklyMission("balance-training-data", [
    { type: "LABEL", imageId: "cat-1", category: "cat" },
    { type: "LABEL", imageId: "cat-2", category: "cat" },
    { type: "LABEL", imageId: "dog-1", category: "dog" },
    { type: "LABEL", imageId: "dog-2", category: "dog" },
    { type: "BALANCE_CHECK", balanced: true },
    { type: "SAY", message: "数据要均衡" },
  ]);
  assert.equal(result.passed, true);
});

test("知识闯关要求全部答对并提交", () => {
  const result = evaluateBlocklyMission("ai-knowledge-quiz", [
    { type: "QUIZ_ANSWER", questionId: "q1", answer: "b" },
    { type: "QUIZ_ANSWER", questionId: "q2", answer: "b" },
    { type: "QUIZ_ANSWER", questionId: "q3", answer: "a" },
    { type: "QUIZ_SUBMIT", score: 3 },
  ]);
  assert.equal(result.passed, true);
});

test("顺序绘本要求场景顺序、停留和结束语", () => {
  const result = evaluateBlocklyMission("ai-sequence-story", [
    { type: "SCENE", sceneId: "classroom" },
    { type: "WAIT", seconds: 1 },
    { type: "SCENE", sceneId: "lab" },
    { type: "WAIT", seconds: 1 },
    { type: "SCENE", sceneId: "future" },
    { type: "SAY", message: "故事结束" },
  ]);
  assert.equal(result.passed, true);
});
