export const VISUAL_MISSION_TEMPLATES = [
  {
    code: "DATA_LABELING",
    name: "数据标注训练",
    summary: "标注图片并训练分类器",
    fields: [
      { key: "requireTrain", label: "必须完成训练", type: "boolean", defaultValue: true },
      { key: "requiredClasses", label: "所需类别（逗号分隔）", type: "csv", defaultValue: "cat,dog" },
    ],
  },
  {
    code: "PREDICTION_BRANCH",
    name: "预测与条件分支",
    summary: "训练后预测，按结果分支说话",
    fields: [
      { key: "imageId", label: "图片 ID", type: "text", defaultValue: "mystery-cat" },
      { key: "expectedCategory", label: "期望类别", type: "select", options: ["cat", "dog"], defaultValue: "cat" },
      { key: "messageKeyword", label: "回答关键词", type: "text", defaultValue: "猫" },
      { key: "requireTrain", label: "必须完成训练", type: "boolean", defaultValue: true },
    ],
  },
  {
    code: "LOOP_ROUTE",
    name: "循环路线",
    summary: "用循环前进并宣布完成",
    fields: [
      { key: "minRepeatTimes", label: "最少循环次数", type: "number", min: 1, max: 10, defaultValue: 2 },
      { key: "maxRepeatTimes", label: "最大循环次数", type: "number", min: 1, max: 10, defaultValue: 10 },
      { key: "minDistance", label: "最少前进距离", type: "number", min: 1, max: 100, defaultValue: 8 },
      { key: "messageKeyword", label: "完成关键词", type: "text", defaultValue: "任务完成" },
    ],
  },
  {
    code: "CONFIDENCE_GATE",
    name: "置信度门槛",
    summary: "达到置信度后再回答",
    fields: [
      { key: "imageId", label: "图片 ID", type: "text", defaultValue: "mystery-cat" },
      { key: "predictionCategory", label: "预测类别", type: "select", options: ["cat", "dog"], defaultValue: "cat" },
      { key: "simulatedConfidence", label: "模拟置信度", type: "number", min: 50, max: 100, defaultValue: 92 },
      { key: "minimumThreshold", label: "最低门槛", type: "number", min: 50, max: 100, defaultValue: 80 },
      { key: "messageKeyword", label: "回答关键词", type: "text", defaultValue: "很有把握" },
    ],
  },
  {
    code: "AGENT_PATROL",
    name: "智能体巡检",
    summary: "感知、判断、循环行动综合任务",
    fields: [
      { key: "imageId", label: "图片 ID", type: "text", defaultValue: "mystery-dog" },
      { key: "expectedCategory", label: "期望类别", type: "select", options: ["cat", "dog"], defaultValue: "dog" },
      { key: "minRepeatTimes", label: "最少循环次数", type: "number", min: 1, max: 10, defaultValue: 2 },
      { key: "maxRepeatTimes", label: "最大循环次数", type: "number", min: 1, max: 10, defaultValue: 10 },
      { key: "minDistance", label: "最少前进距离", type: "number", min: 1, max: 100, defaultValue: 8 },
      { key: "messageKeyword", label: "完成关键词", type: "text", defaultValue: "巡检完成" },
    ],
  },
  {
    code: "DATA_BALANCE",
    name: "数据均衡与公平",
    summary: "比较类别数量，发现数据偏差",
    fields: [
      { key: "requiredClasses", label: "需要比较的类别（逗号分隔）", type: "csv", defaultValue: "cat,dog" },
      { key: "minSamplesPerClass", label: "每类最少样本数", type: "number", min: 1, max: 6, defaultValue: 2 },
      { key: "maxDifference", label: "类别最大数量差", type: "number", min: 0, max: 6, defaultValue: 0 },
      { key: "messageKeyword", label: "公平性说明关键词", type: "text", defaultValue: "数据要均衡" },
    ],
  },
  {
    code: "QUIZ_GAME",
    name: "AI 知识闯关",
    summary: "选择答案、计分并获得即时反馈",
    fields: [
      { key: "expectedAnswers", label: "三题答案（逗号分隔）", type: "csv", defaultValue: "b,b,a" },
      { key: "passScore", label: "通关分数", type: "number", min: 1, max: 3, defaultValue: 3 },
    ],
  },
  {
    code: "SEQUENCE_STORY",
    name: "顺序故事绘本",
    summary: "切换场景、等待并按顺序讲故事",
    fields: [
      { key: "requiredScenes", label: "场景顺序（逗号分隔）", type: "csv", defaultValue: "classroom,lab,future" },
      { key: "minWaitSeconds", label: "每幕最短停留秒数", type: "number", min: 1, max: 10, defaultValue: 1 },
      { key: "messageKeyword", label: "故事结束关键词", type: "text", defaultValue: "故事结束" },
    ],
  },
];

export const STAGE_OPTIONS = [
  { value: "LOWER_PRIMARY", label: "小学低年级" },
  { value: "UPPER_PRIMARY", label: "小学高年级" },
  { value: "JUNIOR_HIGH", label: "初中" },
  { value: "SENIOR_HIGH", label: "高中" },
];

export const STATUS_META = {
  DRAFT: { label: "草稿", tone: "draft" },
  PUBLISHED: { label: "已发布", tone: "published" },
  OFFLINE: { label: "已下架", tone: "offline" },
};

export function templateByCode(code) {
  return VISUAL_MISSION_TEMPLATES.find((item) => item.code === code) || VISUAL_MISSION_TEMPLATES[0];
}

export function defaultConfigForTemplate(code) {
  const template = templateByCode(code);
  const config = {};
  for (const field of template.fields) {
    config[field.key] = field.defaultValue;
  }
  if (code === "DATA_LABELING") {
    config.expectedLabels = {
      "cat-1": "cat",
      "cat-2": "cat",
      "dog-1": "dog",
      "dog-2": "dog",
    };
  }
  return config;
}

export function emptyMissionForm(templateCode = "CONFIDENCE_GATE") {
  return {
    missionCode: "",
    templateCode,
    title: "",
    shortTitle: "",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "",
    description: "",
    story: "",
    goal: "",
    hint: "",
    badge: "",
    reflection: "",
    steps: ["第一步", "第二步", "第三步"],
    concepts: ["概念一"],
    config: defaultConfigForTemplate(templateCode),
    sortOrder: 10,
    lockVersion: 0,
  };
}
