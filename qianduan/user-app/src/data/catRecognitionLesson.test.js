import assert from "node:assert/strict";
import test from "node:test";
import { catPictureBook, fallbackRecommendation, lessonProgress } from "./catRecognitionLesson.js";

test("cat picture book is reviewed and has a complete low-reading sequence", () => {
  assert.equal(catPictureBook.reviewStatus, "APPROVED");
  assert.equal(catPictureBook.pages.length, 4);
  catPictureBook.pages.forEach((page, index) => {
    assert.equal(page.pageNo, index + 1);
    assert.ok(page.narration.length > 20);
    assert.ok(page.alt);
  });
});

test("lesson progress and recommendation react to server mastery", () => {
  assert.equal(lessonProgress("reward"), 100);
  assert.equal(fallbackRecommendation(40).code, "machine_learning.image_classification");
  assert.equal(fallbackRecommendation(80).code, "computer_vision.object_detection");
});
