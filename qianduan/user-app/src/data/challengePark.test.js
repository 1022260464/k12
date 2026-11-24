import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryKeyForMission,
  challengeParkSummary,
  groupChallengeMissions,
  missionChallengePoints,
} from "./challengePark.js";

const missions = [
  { id: "data-1", knowledgeCode: "data_literacy.what_is_data" },
  { id: "ml-1", knowledgeCode: "ai.ml.classification" },
  { id: "code-1", knowledgeCode: "programming.loop.sequence" },
];

test("challenge missions are grouped by knowledge area", () => {
  assert.equal(categoryKeyForMission(missions[0]), "data");
  assert.equal(categoryKeyForMission(missions[1]), "machine-learning");
  assert.equal(categoryKeyForMission(missions[2]), "programming");
  assert.deepEqual(
    groupChallengeMissions(missions).map((category) => category.missions.length),
    [1, 1, 1],
  );
});

test("challenge points follow first-clear plus star rewards", () => {
  assert.equal(missionChallengePoints({ stars: 3 }), 115);
  assert.equal(missionChallengePoints({ stars: 1 }), 105);
  assert.equal(missionChallengePoints(null), 0);
});

test("challenge summary counts stars, points, completed categories, and next mission", () => {
  const summary = challengeParkSummary(missions, {
    "data-1": { stars: 3 },
    "ml-1": { stars: 3 },
  });

  assert.equal(summary.stars, 6);
  assert.equal(summary.points, 230);
  assert.equal(summary.completedMissions, 2);
  assert.equal(summary.passedCategories, 2);
  assert.equal(summary.totalCategories, 3);
  assert.equal(summary.nextMission.id, "code-1");
});
