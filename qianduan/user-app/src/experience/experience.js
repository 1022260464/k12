export const EXPERIENCE_STORAGE_KEY = "k12_student_experience";

export const EXPERIENCE = Object.freeze({
  PRIMARY: "primary",
  TEEN: "teen",
});

export const experienceNavigation = Object.freeze({
  [EXPERIENCE.PRIMARY]: [
    ["home", "首页"],
    ["ai-studio", "问问小智"],
    ["picture-books", "互动绘本"],
    ["courses", "探索课程"],
    ["tasks", "趣味任务"],
    ["visual-code-lab", "图形编程"],
    ["progress", "我的成长"],
  ],
  [EXPERIENCE.TEEN]: [
    ["home", "学习首页"],
    ["ai-studio", "AI 学习台"],
    ["courses", "课程中心"],
    ["tasks", "作业练习"],
    ["visual-code-lab", "AI 实验室"],
    ["leaderboard", "学习排行"],
    ["progress", "学习报告"],
  ],
});

export function experienceForSchoolStage(stage) {
  return ["PRIMARY_LOWER", "PRIMARY_UPPER"].includes(stage)
    ? EXPERIENCE.PRIMARY
    : EXPERIENCE.TEEN;
}

export function readStoredExperience() {
  const stored = window.localStorage.getItem(EXPERIENCE_STORAGE_KEY);
  return Object.values(EXPERIENCE).includes(stored) ? stored : null;
}

export function storeExperience(experience) {
  window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, experience);
}
