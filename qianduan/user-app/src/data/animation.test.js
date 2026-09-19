import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBarSortAnimation, normalizeBubbleSortAnimation } from "./animation.js";

const valid = {
  kind: "ANIMATION",
  mimeType: "application/vnd.k12.animation.v1+json",
  payload: {
    schemaVersion: "1.0",
    animationType: "bubble-sort",
    title: "冒泡排序",
    initialValues: [5, 2],
    steps: [
      { step: 1, pass: 1, action: "compare", indices: [0, 1], values: [5, 2], narration: "比较" },
      { step: 2, pass: 1, action: "swap", indices: [0, 1], values: [2, 5], narration: "交换" },
      { step: 3, pass: null, action: "complete", indices: [], values: [2, 5], narration: "完成" },
    ],
  },
};

test("accepts the versioned bubble-sort artifact", () => {
  assert.equal(normalizeBubbleSortAnimation(valid)?.steps.length, 3);
});

test("accepts selection-sort with the shared bar player", () => {
  const selection = {
    ...valid,
    payload: {
      ...valid.payload,
      animationType: "selection-sort",
      title: "选择排序",
    },
  };
  assert.equal(normalizeBarSortAnimation(selection)?.animationType, "selection-sort");
  assert.equal(normalizeBubbleSortAnimation(selection), null);
});

test("accepts insertion-sort and search animations", () => {
  const insertion = {
    ...valid,
    payload: {
      ...valid.payload,
      animationType: "insertion-sort",
      title: "插入排序",
    },
  };
  assert.equal(normalizeBarSortAnimation(insertion)?.animationType, "insertion-sort");

  const linear = {
    ...valid,
    payload: {
      ...valid.payload,
      animationType: "linear-search",
      title: "线性查找",
      steps: [
        { step: 1, pass: null, action: "probe", indices: [0], values: [5, 2], narration: "探测" },
        { step: 2, pass: null, action: "found", indices: [0], values: [5, 2], narration: "命中" },
        { step: 3, pass: null, action: "complete", indices: [], values: [5, 2], narration: "完成" },
      ],
    },
  };
  assert.equal(normalizeBarSortAnimation(linear)?.animationType, "linear-search");

  const binary = {
    ...linear,
    payload: {
      ...linear.payload,
      animationType: "binary-search",
      title: "二分查找",
    },
  };
  assert.equal(normalizeBarSortAnimation(binary)?.animationType, "binary-search");
});

test("rejects unsupported artifact types and versions", () => {
  assert.equal(normalizeBubbleSortAnimation({ ...valid, mimeType: "text/html" }), null);
  assert.equal(normalizeBubbleSortAnimation({ ...valid, payload: { ...valid.payload, schemaVersion: "2.0" } }), null);
});

test("rejects executable or oversized step data", () => {
  const invalid = { ...valid, payload: { ...valid.payload, steps: [{ ...valid.payload.steps[0], action: "eval" }] } };
  assert.equal(normalizeBubbleSortAnimation(invalid), null);
  const oversized = { ...valid, payload: { ...valid.payload, steps: Array(101).fill(valid.payload.steps[0]) } };
  assert.equal(normalizeBubbleSortAnimation(oversized), null);
});

test("rejects out-of-bounds indices", () => {
  const invalid = { ...valid, payload: { ...valid.payload, steps: [{ ...valid.payload.steps[0], indices: [0, 9] }] } };
  assert.equal(normalizeBubbleSortAnimation(invalid), null);
});
