// 「为什么安排此任务」的可解释文案（需求 §5.3）。
// 只基于真实数据（掌握度/薄弱前置/兴趣）组织句子，缺数据的部分不编。

const WEAK_THRESHOLD = 70;

export function topWeakPoints(mastery = [], limit = 3) {
  return (Array.isArray(mastery) ? mastery : [])
    .filter((item) => Number.isFinite(item?.masteryPercent) && item.masteryPercent < WEAK_THRESHOLD)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)
    .slice(0, limit);
}

export function averageMastery(mastery = []) {
  const rows = (Array.isArray(mastery) ? mastery : []).filter(
    (item) => Number.isFinite(item?.masteryPercent),
  );
  if (!rows.length) return null;
  return Math.round(rows.reduce((sum, item) => sum + item.masteryPercent, 0) / rows.length);
}

const STAGE_LABELS = {
  PRIMARY_LOWER: "小学低年级",
  PRIMARY_UPPER: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

// 学段从低到高，用于判断知识点是否「起步就高于当前学段」。
const STAGE_ORDER = ["小学低年级", "小学高年级", "初中", "高中"];

/**
 * 挑战积分口径（与排行榜 SQL 保持一致，勿单边修改）：
 * 每个知识点 = ROUND(掌握度) + 通关奖励（最新得分 ≥90 +15 / ≥60 +10 / >0 +5）。
 */
export function challengeBonusFor(latestScorePercent) {
  if (!(latestScorePercent > 0)) return 0;
  if (latestScorePercent >= 90) return 15;
  if (latestScorePercent >= 60) return 10;
  return 5;
}

export function challengePointsForRow(row) {
  if (!Number.isFinite(row?.masteryPercent)) return 0;
  return Math.round(row.masteryPercent) + challengeBonusFor(row?.latestScorePercent);
}

export function challengePointsTotal(mastery = []) {
  return (Array.isArray(mastery) ? mastery : []).reduce(
    (sum, row) => sum + challengePointsForRow(row),
    0,
  );
}

export function starsForPercent(percent) {
  if (!(percent > 0)) return 0;
  if (percent >= 90) return 3;
  if (percent >= 60) return 2;
  return 1;
}

/** 知识点级学段过滤：只保留起步学段不高于当前学段的知识点（闯关地图用）。 */
export function filterPointsByStage(points = [], schoolStage) {
  const stageIndex = STAGE_ORDER.indexOf(STAGE_LABELS[schoolStage]);
  if (stageIndex < 0 || !Array.isArray(points) || !points.length) {
    return Array.isArray(points) ? points : [];
  }
  return points.filter((point) => {
    const stages = point?.stages || [];
    if (!stages.length) return true;
    const indexes = stages.map((stage) => STAGE_ORDER.indexOf(stage)).filter((index) => index >= 0);
    if (!indexes.length) return true;
    return Math.min(...indexes) <= stageIndex;
  });
}

/**
 * 按学段过滤薄弱点：只滤掉起步学段就高于当前学段的知识点
 * （如小学低年级档案不该被提示「插入排序薄弱」）；覆盖到当前或更低
 * 学段的一律保留，学段信息缺失的也不误杀。平均掌握仍用全量记录，
 * 跨学段历史在「学习进度」页照常可见。
 */
export function filterMasteryByStage(mastery = [], schoolStage, points = []) {
  const stageIndex = STAGE_ORDER.indexOf(STAGE_LABELS[schoolStage]);
  if (stageIndex < 0 || !Array.isArray(points) || !points.length) {
    return Array.isArray(mastery) ? mastery : [];
  }
  const stagesByCode = new Map(points.map((point) => [point?.code, point?.stages || []]));
  return (Array.isArray(mastery) ? mastery : []).filter((item) => {
    const stages = stagesByCode.get(item?.knowledgeCode);
    if (!stages || !stages.length) return true;
    const indexes = stages.map((stage) => STAGE_ORDER.indexOf(stage)).filter((index) => index >= 0);
    if (!indexes.length) return true;
    return Math.min(...indexes) <= stageIndex;
  });
}

function labelOf(item) {
  return item?.topic || item?.title || item?.knowledgeCode || item?.code || "这个知识点";
}

/**
 * 生成一句「为什么安排此任务」。优先级：薄弱点 > 前置缺口 > 兴趣 > 兜底。
 * @param {object} input
 * @param {string} [input.topicTitle] 当前任务主题名（可空=还没开课）
 * @param {Array}  [input.mastery]    练习掌握度 [{topic, masteryPercent}]
 * @param {Array}  [input.gaps]       当前主题的薄弱前置 [{title/code, masteryPercent}]（服务端只回薄弱项）
 * @param {Array}  [input.interests]  画像兴趣标签
 */
export function buildLessonWhy({ topicTitle, mastery = [], gaps = [], interests = [] } = {}) {
  const weak = topWeakPoints(mastery, 1)[0] || null;
  const gap = (Array.isArray(gaps) ? gaps : [])[0] || null;
  const topicPart = topicTitle ? `「${topicTitle}」` : "";

  if (weak && gap && labelOf(gap) !== labelOf(weak)) {
    return `根据最近练习，「${labelOf(weak)}」还没掌握牢（${Math.round(weak.masteryPercent)}%）；它又是学${topicPart}的前置，先补它，后面就顺了。`;
  }
  if (gap) {
    return `学${topicPart}之前要先懂「${labelOf(gap)}」，所以先安排这一步，补牢再往前。`;
  }
  if (weak && topicTitle) {
    return `根据最近练习，「${labelOf(weak)}」还没掌握牢（${Math.round(weak.masteryPercent)}%），先把它补牢，再学${topicPart}就更稳。`;
  }
  if (weak) {
    return `根据最近练习，「${labelOf(weak)}」还没掌握牢（${Math.round(weak.masteryPercent)}%），建议先复习它。`;
  }
  if (topicTitle && Array.isArray(interests) && interests.length) {
    return `结合你的兴趣（${interests.slice(0, 2).join("、")}），安排${topicPart}正合适。`;
  }
  if (topicTitle) {
    return `${topicPart}和你的学段匹配，小智会按你的进度来讲。`;
  }
  return "先从左侧挑一个主题开始；小智会按你的学段和薄弱点来安排讲法。";
}
