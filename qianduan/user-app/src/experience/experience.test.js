import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPERIENCE,
  courseMatchesLearningScope,
  experienceForSchoolStage,
  learningProfileLabel,
} from "./experience.js";

test("learning profile selects the matching student experience", () => {
  assert.equal(experienceForSchoolStage("PRIMARY_LOWER"), EXPERIENCE.PRIMARY);
  assert.equal(experienceForSchoolStage("PRIMARY_UPPER"), EXPERIENCE.PRIMARY);
  assert.equal(experienceForSchoolStage("JUNIOR_HIGH"), EXPERIENCE.TEEN);
  assert.equal(experienceForSchoolStage("SENIOR_HIGH"), EXPERIENCE.TEEN);
});

test("course grade labels are filtered against the profile stage", () => {
  assert.equal(courseMatchesLearningScope("小学低年级", "PRIMARY_LOWER", EXPERIENCE.PRIMARY), true);
  assert.equal(courseMatchesLearningScope("小学高年级", "PRIMARY_LOWER", EXPERIENCE.PRIMARY), false);
  assert.equal(courseMatchesLearningScope("七至九年级", "JUNIOR_HIGH", EXPERIENCE.TEEN), true);
  assert.equal(courseMatchesLearningScope("高中", "JUNIOR_HIGH", EXPERIENCE.TEEN), false);
  assert.equal(courseMatchesLearningScope("全年级", "JUNIOR_HIGH", EXPERIENCE.TEEN), true);
});

test("manual experience preview still receives courses for that experience", () => {
  assert.equal(courseMatchesLearningScope("小学高年级", "JUNIOR_HIGH", EXPERIENCE.PRIMARY), true);
  assert.equal(courseMatchesLearningScope("高中", "PRIMARY_LOWER", EXPERIENCE.TEEN), true);
});

test("learning profile label includes stage and grade", () => {
  assert.equal(learningProfileLabel({ schoolStage: "JUNIOR_HIGH", grade: 8 }), "初中 · 8 年级");
});
