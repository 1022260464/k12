export const EXPERIENCE_STORAGE_KEY = "k12_student_experience";

export const EXPERIENCE = Object.freeze({
  PRIMARY: "primary",
  TEEN: "teen",
});

export const SCHOOL_STAGE = Object.freeze({
  PRIMARY_LOWER: "PRIMARY_LOWER",
  PRIMARY_UPPER: "PRIMARY_UPPER",
  JUNIOR_HIGH: "JUNIOR_HIGH",
  SENIOR_HIGH: "SENIOR_HIGH",
});

const stageLabels = Object.freeze({
  [SCHOOL_STAGE.PRIMARY_LOWER]: "小学低年级",
  [SCHOOL_STAGE.PRIMARY_UPPER]: "小学高年级",
  [SCHOOL_STAGE.JUNIOR_HIGH]: "初中",
  [SCHOOL_STAGE.SENIOR_HIGH]: "高中",
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
  return [SCHOOL_STAGE.PRIMARY_LOWER, SCHOOL_STAGE.PRIMARY_UPPER].includes(stage)
    ? EXPERIENCE.PRIMARY
    : EXPERIENCE.TEEN;
}

export function schoolStageLabel(stage) {
  return stageLabels[stage] || "学段未设置";
}

export function learningProfileLabel(profile) {
  if (!profile?.schoolStage) return "学段未设置";
  const grade = Number(profile.grade);
  return [schoolStageLabel(profile.schoolStage), Number.isFinite(grade) ? `${grade} 年级` : null]
    .filter(Boolean)
    .join(" · ");
}

function inferredCourseStages(gradeLevel) {
  const value = String(gradeLevel || "").trim().toUpperCase();
  if (!value) return [];
  if (/全年级|全学段|通用|ALL/.test(value)) return Object.values(SCHOOL_STAGE);

  const stages = new Set();
  if (/小学低|低年级|PRIMARY_LOWER|LOW_PRIMARY|LOWER_PRIMARY|[一二三1-3](?:至|到|-)?[一二三1-3]?年级/.test(value)) {
    stages.add(SCHOOL_STAGE.PRIMARY_LOWER);
  }
  if (/小学高|高年级|PRIMARY_UPPER|HIGH_PRIMARY|UPPER_PRIMARY|[四五六4-6](?:至|到|-)?[四五六4-6]?年级/.test(value)) {
    stages.add(SCHOOL_STAGE.PRIMARY_UPPER);
  }
  if (/初中|JUNIOR_HIGH|MIDDLE_SCHOOL|[七八九7-9](?:至|到|-)?[七八九7-9]?年级/.test(value)) {
    stages.add(SCHOOL_STAGE.JUNIOR_HIGH);
  }
  if (/高中|高一|高二|高三|SENIOR_HIGH|HIGH_SCHOOL|十年级|十一年级|十二年级|1[0-2]年级/.test(value)) {
    stages.add(SCHOOL_STAGE.SENIOR_HIGH);
  }
  if (/小学/.test(value) && !stages.size) {
    stages.add(SCHOOL_STAGE.PRIMARY_LOWER);
    stages.add(SCHOOL_STAGE.PRIMARY_UPPER);
  }
  if (/初高中|中学/.test(value) && !stages.size) {
    stages.add(SCHOOL_STAGE.JUNIOR_HIGH);
    stages.add(SCHOOL_STAGE.SENIOR_HIGH);
  }
  return [...stages];
}

export function courseMatchesLearningScope(gradeLevel, schoolStage, experience = EXPERIENCE.TEEN) {
  const stages = inferredCourseStages(gradeLevel);
  if (!stages.length) return true;
  if (schoolStage && experienceForSchoolStage(schoolStage) === experience) {
    return stages.includes(schoolStage);
  }
  return stages.some((stage) => experienceForSchoolStage(stage) === experience);
}

export function readStoredExperience() {
  const stored = window.localStorage.getItem(EXPERIENCE_STORAGE_KEY);
  return Object.values(EXPERIENCE).includes(stored) ? stored : null;
}

export function storeExperience(experience) {
  window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, experience);
}
