const CATEGORY_ORDER = ["data", "machine-learning", "programming", "creation", "exploration"];

const CATEGORY_META = Object.freeze({
  data: {
    key: "data",
    title: "数据素养",
    description: "数据、标签与负责任地使用 AI",
    tone: "data",
  },
  "machine-learning": {
    key: "machine-learning",
    title: "机器学习",
    description: "分类、预测与置信度",
    tone: "machine-learning",
  },
  programming: {
    key: "programming",
    title: "编程思维",
    description: "顺序、循环与智能体行动",
    tone: "programming",
  },
  creation: {
    key: "creation",
    title: "AI 创作",
    description: "故事、绘本与多模态表达",
    tone: "creation",
  },
  exploration: {
    key: "exploration",
    title: "综合探索",
    description: "把学到的知识组合起来解决问题",
    tone: "exploration",
  },
});

export function categoryKeyForMission(mission) {
  const code = String(mission?.knowledgeCode || "").toLowerCase();
  if (code.startsWith("data_literacy") || code.startsWith("ai.data")) return "data";
  if (code.startsWith("ai.ml") || code.startsWith("machine_learning")) return "machine-learning";
  if (
    code.startsWith("programming")
    || code.startsWith("visual_programming")
    || code.startsWith("ai.agent")
  ) return "programming";
  if (code.startsWith("multimodal") || code.startsWith("generative_ai")) return "creation";
  return "exploration";
}

export function groupChallengeMissions(missions = []) {
  const grouped = new Map();
  missions.forEach((mission) => {
    const key = categoryKeyForMission(mission);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(mission);
  });
  return CATEGORY_ORDER
    .filter((key) => grouped.has(key))
    .map((key) => ({ ...CATEGORY_META[key], missions: grouped.get(key) }));
}

export function missionChallengePoints(record) {
  if (!record) return 0;
  const stars = Math.min(3, Math.max(0, Number(record.stars) || 0));
  return 100 + stars * 5;
}

export function challengeParkSummary(missions = [], completed = {}) {
  const completedMissions = missions.filter((mission) => completed[mission.id] || completed[mission.missionCode]);
  const stars = completedMissions.reduce(
    (total, mission) => total + Number(completed[mission.id]?.stars || completed[mission.missionCode]?.stars || 0),
    0,
  );
  const points = completedMissions.reduce(
    (total, mission) => total + missionChallengePoints(completed[mission.id] || completed[mission.missionCode]),
    0,
  );
  const categories = groupChallengeMissions(missions);
  const passedCategories = categories.filter(
    (category) => category.missions.every(
      (mission) => completed[mission.id] || completed[mission.missionCode],
    ),
  ).length;
  const nextMission = missions.find(
    (mission) => !completed[mission.id] && !completed[mission.missionCode],
  ) || null;

  return {
    stars,
    points,
    completedMissions: completedMissions.length,
    passedCategories,
    totalCategories: categories.length,
    nextMission,
  };
}
