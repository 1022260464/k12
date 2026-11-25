export const BLOCKLY_STORAGE_VERSION = 1;

/** 前端工具箱白名单：未知分类忽略。 */
export const SAFE_TOOLBOX_CATEGORIES = new Set([
  "events", "data", "ai", "logic", "control", "motion", "looks", "fairness", "game", "story",
]);

/**
 * 内置兜底关卡（服务端不可用 / 未升级库时使用）。
 * 字段对齐 published API：missionCode、templateCode、runtimeConfig。
 */
export const DEFAULT_BLOCKLY_MISSIONS = [
  {
    id: "label-training-data",
    missionCode: "label-training-data",
    templateCode: "DATA_LABELING",
    order: 1,
    sortOrder: 1,
    title: "给图片贴标签",
    shortTitle: "整理训练数据",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "ai.data.labeling",
    description: "把猫和狗图片贴上正确标签，再训练一个分类器。",
    story: "数据站收到了一批没有名字的图片。请你成为数据整理员，教会机器人认识猫和狗。",
    goal: "正确标注 4 张图片，并完成一次训练。",
    recipe: ["「开始任务」×1", "「猫图片 1 是 猫」这样 ×4：猫图 1、猫图 2→猫；狗图 1、狗图 2→狗", "「教 AI 认识这些图片」×1（接在最后）"],
    hint: "从“AI 数据”里拖 4 块「__ 是 __」，下拉框里选图片、选它是猫还是狗，最后接上「教 AI 认识这些图片」。",
    concepts: ["训练数据", "标签", "分类"],
    steps: ["观察图片编号", "贴上猫或狗标签", "训练分类器"],
    badge: "数据整理员",
    reflection: "AI 不会凭空认识图片，它需要人类提供正确、丰富的训练数据。",
    toolboxCategories: ["events", "data", "ai", "looks"],
    runtimeConfig: {
      expectedLabels: { "cat-1": "cat", "cat-2": "cat", "dog-1": "dog", "dog-2": "dog" },
      requiredClasses: ["cat", "dog"],
      requireTrain: true,
    },
    theme: "labeling",
  },
  {
    id: "predict-and-decide",
    missionCode: "predict-and-decide",
    templateCode: "PREDICTION_BRANCH",
    order: 2,
    sortOrder: 2,
    title: "让 AI 做出判断",
    shortTitle: "预测与条件",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "ai.ml.classification",
    description: "训练分类器、预测新图片，并根据预测结果说出答案。",
    story: "新的图片没有标签。让机器人用刚刚学到的规律进行预测，并用条件积木决定是否回答。",
    goal: "完成训练和预测，用条件积木判断“神秘图片”是不是猫。",
    recipe: ["「开始任务」×1", "「教 AI 认识这些图片」→「让 AI 猜」选神秘图片", "「如果」判断口放「AI 猜的是 猫」", "「如果」里放「说」：这是猫"],
    hint: "依次连接「教 AI 认识这些图片」「让 AI 猜」「如果」；把「AI 猜的是 猫」放进如果的判断口。",
    concepts: ["训练", "预测", "条件判断"],
    steps: ["训练已有数据", "预测神秘图片", "判断后说出答案"],
    badge: "分类小侦探",
    reflection: "预测是 AI 根据已有规律作出的判断，它不一定永远正确。",
    toolboxCategories: ["events", "ai", "logic", "looks"],
    runtimeConfig: {
      imageId: "mystery-cat",
      expectedCategory: "cat",
      messageKeyword: "猫",
      requireTrain: true,
    },
    theme: "predict",
  },
  {
    id: "repeat-a-route",
    missionCode: "repeat-a-route",
    templateCode: "LOOP_ROUTE",
    order: 3,
    sortOrder: 3,
    title: "规划机器人的路线",
    shortTitle: "循环与行动",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "programming.loop.sequence",
    description: "使用循环减少重复积木，让 AI 机器人走到数据站。",
    story: "机器人要搬运训练数据。重复拖很多相同积木太麻烦，请用循环设计更简洁的路线。",
    goal: "让机器人累计前进至少 8 步，并在到达后说“任务完成”。",
    recipe: ["「开始任务」×1", "「重复 4 次」里放「往前走 2 步」", "循环后面接「说」：任务完成"],
    hint: "把「往前走 2 步」放进重复 4 次里，然后在循环后连接说话积木。",
    concepts: ["顺序", "循环", "自动执行"],
    steps: ["设定重复次数", "把移动放入循环", "到达后播报结果"],
    badge: "循环工程师",
    reflection: "循环可以让计算机重复执行同一组指令，使程序更短、更容易修改。",
    toolboxCategories: ["events", "control", "motion", "looks"],
    runtimeConfig: {
      minRepeatTimes: 2,
      maxRepeatTimes: 10,
      minDistance: 8,
      messageKeyword: "任务完成",
    },
    theme: "route",
  },
  {
    id: "confidence-gate",
    missionCode: "confidence-gate",
    templateCode: "CONFIDENCE_GATE",
    order: 4,
    sortOrder: 4,
    title: "有把握再回答",
    shortTitle: "认识置信度",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "ai.ml.confidence",
    description: "读取预测置信度，只有把握足够大时才让机器人回答。",
    story: "AI 有时也会犹豫。请设置一道“信心门”，让它只有在置信度达到 80% 时才回答。",
    goal: "训练并预测神秘图片；当置信度至少为 80% 时，说“我很有把握”。",
    recipe: ["「开始任务」×1", "「教 AI 认识这些图片」→「让 AI 猜」选神秘图片", "「如果」判断口放「AI 至少有 80% 把握」", "「如果」里放「说」：我很有把握"],
    hint: "依次连接「教 AI 认识这些图片」「让 AI 猜」和「如果」；把「AI 至少有 80% 把握」放进如果，再在里面放说话积木。",
    concepts: ["置信度", "阈值", "负责任的 AI"],
    steps: ["完成模型训练", "获得预测置信度", "达到阈值才回答"],
    badge: "谨慎判断员",
    reflection: "置信度表示模型有多确定，但高置信度也不等于答案一定正确。",
    toolboxCategories: ["events", "ai", "logic", "looks"],
    runtimeConfig: {
      imageId: "mystery-cat",
      predictionCategory: "cat",
      simulatedConfidence: 92,
      minimumThreshold: 80,
      messageKeyword: "很有把握",
    },
    theme: "confidence",
  },
  {
    id: "campus-ai-patrol",
    missionCode: "campus-ai-patrol",
    templateCode: "AGENT_PATROL",
    order: 5,
    sortOrder: 5,
    title: "校园 AI 巡检挑战",
    shortTitle: "综合智能任务",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "ai.agent.sense-decide-act",
    description: "把训练、感知、判断、循环行动组合成一套完整的智能任务。",
    story: "机器人要识别校园小狗，识别成功后前往数据站并报告巡检完成。现在由你设计完整流程。",
    goal: "预测校园小狗；判断为狗后，用循环前进至少 8 步，并说“巡检完成”。",
    recipe: ["「开始任务」×1", "「教 AI 认识这些图片」→「让 AI 猜」选校园小狗", "「如果 AI 猜的是 狗」里放「重复 4 次」+「往前走 2 步」", "「如果」里最后放「说」：巡检完成"],
    hint: "先教 AI 再猜校园小狗；把循环移动和说“巡检完成”都放在「如果 AI 猜的是 狗」里面。",
    concepts: ["感知", "决策", "行动", "智能体"],
    steps: ["感知校园图片", "判断识别结果", "循环行动并报告"],
    badge: "AI 巡检队长",
    reflection: "智能体通常会经历感知环境、作出决策、执行行动三个连续步骤。",
    toolboxCategories: ["events", "ai", "logic", "control", "motion", "looks"],
    runtimeConfig: {
      imageId: "mystery-dog",
      expectedCategory: "dog",
      minRepeatTimes: 2,
      maxRepeatTimes: 10,
      minDistance: 8,
      messageKeyword: "巡检完成",
    },
    theme: "patrol",
  },
  {
    id: "balance-training-data",
    missionCode: "balance-training-data",
    templateCode: "DATA_BALANCE",
    order: 6,
    sortOrder: 6,
    title: "让训练数据更公平",
    shortTitle: "数据均衡",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "data_literacy.bias_in_data",
    description: "比较猫和狗的样本数量，发现不均衡数据可能带来的偏差。",
    story: "机器人只看过很多猫，却只看过一只狗。请补齐训练数据，让它公平地学习每个类别。",
    goal: "猫和狗各准备 2 个样本，检查数据均衡，并说明“数据要均衡”。",
    recipe: ["「开始任务」×1", "「猫图片 1 是 猫」这样 ×4：猫、狗各 2 张", "「看看猫和狗是不是一样多」×1", "「说」×1：写「数据要均衡」"],
    hint: "各放两块猫、狗的「__ 是 __」，再连接「看看猫和狗是不是一样多」和说话积木。",
    concepts: ["数据均衡", "偏差", "负责任 AI"],
    steps: ["准备两类训练样本", "比较类别数量", "解释为什么要均衡"],
    badge: "公平数据观察员",
    reflection: "训练数据失衡会让模型更熟悉某些类别，可能产生不公平的结果。",
    toolboxCategories: ["events", "data", "fairness", "looks"],
    runtimeConfig: {
      requiredClasses: ["cat", "dog"],
      minSamplesPerClass: 2,
      maxDifference: 0,
      messageKeyword: "数据要均衡",
    },
    theme: "balance",
  },
  {
    id: "ai-knowledge-quiz",
    missionCode: "ai-knowledge-quiz",
    templateCode: "QUIZ_GAME",
    order: 7,
    sortOrder: 7,
    title: "AI 知识连胜挑战",
    shortTitle: "趣味小测",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "visual_programming.conditionals",
    description: "回答三道 AI 基础题，提交答案并获得即时计分反馈。",
    story: "知识星球开启了三道挑战门。连续答对问题，帮助机器人收集全部能量星。",
    goal: "依次回答三道题，至少答对 3 题并提交答案。",
    recipe: ["「开始任务」×1", "「第 1 题我选 …」×3：第 1 题选 B、第 2 题选 B、第 3 题选 A", "「交卷，看能得几分」×1（放最后）"],
    hint: "连接三块「第 __ 题我选 __」：第 1 题选 B、第 2 题选 B、第 3 题选 A，最后「交卷，看能得几分」。",
    concepts: ["即时反馈", "知识巩固", "连续答对"],
    steps: ["阅读三道问题", "选择每题答案", "提交并查看得分"],
    badge: "AI 知识连胜王",
    reflection: "及时反馈可以帮助我们发现误解，并调整下一步学习内容。",
    toolboxCategories: ["events", "game"],
    runtimeConfig: {
      expectedAnswers: ["b", "b", "a"],
      passScore: 3,
    },
    theme: "quiz",
  },
  {
    id: "ai-sequence-story",
    missionCode: "ai-sequence-story",
    templateCode: "SEQUENCE_STORY",
    order: 8,
    sortOrder: 8,
    title: "小机器人的 AI 一天",
    shortTitle: "顺序绘本",
    stageCode: "UPPER_PRIMARY",
    knowledgeCode: "multimodal_learning.ai_storybook",
    description: "用场景、角色台词和等待积木制作一段按顺序播放的 AI 知识故事。",
    story: "小机器人从教室出发，走进实验室学习 AI，最后来到未来城市分享自己的发现。",
    goal: "按教室、实验室、未来城市的顺序切换场景，场景之间等待，并说“故事结束”。",
    recipe: ["「开始任务」×1", "「去 …」×3：AI 教室→AI 实验室→未来城市", "每两幕之间放「等 1 秒」", "最后接「说」：故事结束"],
    hint: "每次「去」一个新场景后让角色说一句话；前两幕之后连接「等 1 秒」，最后说结束语。",
    concepts: ["顺序执行", "场景叙事", "互动绘本"],
    steps: ["进入教室场景", "经过实验室场景", "在未来城市结束故事"],
    badge: "AI 绘本导演",
    reflection: "计算机会严格按顺序执行指令，清晰的流程能让故事更容易理解。",
    toolboxCategories: ["events", "story", "looks"],
    runtimeConfig: {
      requiredScenes: ["classroom", "lab", "future"],
      minWaitSeconds: 1,
      messageKeyword: "故事结束",
    },
    theme: "story",
  },
];

/** @deprecated 使用 DEFAULT_BLOCKLY_MISSIONS */
export const BLOCKLY_MISSIONS = DEFAULT_BLOCKLY_MISSIONS;

export function normalizeMission(raw) {
  if (!raw) return null;
  const missionCode = raw.missionCode || raw.id;
  const toolboxCategories = (raw.toolboxCategories || [])
    .filter((item) => SAFE_TOOLBOX_CATEGORIES.has(item));
  const fallback = DEFAULT_BLOCKLY_MISSIONS.find((item) => item.missionCode === missionCode);
  return {
    ...fallback,
    ...raw,
    id: missionCode,
    missionCode,
    templateCode: raw.templateCode || fallback?.templateCode || "DATA_LABELING",
    toolboxCategories: toolboxCategories.length
      ? toolboxCategories
      : (fallback?.toolboxCategories || ["events", "looks"]),
    runtimeConfig: raw.runtimeConfig || raw.config || fallback?.runtimeConfig || {},
    steps: Array.isArray(raw.steps) ? raw.steps : (fallback?.steps || []),
    concepts: Array.isArray(raw.concepts) ? raw.concepts : (fallback?.concepts || []),
    recipe: Array.isArray(raw.recipe) ? raw.recipe : (fallback?.recipe || []),
    theme: raw.theme || themeFromTemplate(raw.templateCode || fallback?.templateCode),
    order: raw.sortOrder ?? raw.order ?? fallback?.order ?? 0,
  };
}

export function themeFromTemplate(templateCode) {
  switch (templateCode) {
    case "DATA_LABELING": return "labeling";
    case "PREDICTION_BRANCH": return "predict";
    case "LOOP_ROUTE": return "route";
    case "CONFIDENCE_GATE": return "confidence";
    case "AGENT_PATROL": return "patrol";
    case "DATA_BALANCE": return "balance";
    case "QUIZ_GAME": return "quiz";
    case "SEQUENCE_STORY": return "story";
    default: return "labeling";
  }
}

export function findBlocklyMission(missionId, missions = DEFAULT_BLOCKLY_MISSIONS) {
  return missions.find((mission) => mission.id === missionId || mission.missionCode === missionId)
    || missions[0]
    || DEFAULT_BLOCKLY_MISSIONS[0];
}

/** 本地即时评分：按 templateCode + runtimeConfig。每项 check 附带失败时的「下一步」建议。 */export function evaluateBlocklyMission(missionOrId, trace = []) {
  const mission = typeof missionOrId === "string"
    ? findBlocklyMission(missionOrId)
    : normalizeMission(missionOrId);
  const checks = missionChecks(mission, trace);
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    passed: checks.length > 0 && passedCount === checks.length,
    stars: Math.min(3, passedCount),
    checks,
  };
}

/** 服务端评分权威（passed/stars），但展示文案与建议用本地算的（服务端 DTO 不带 advice）。 */
export function mergeEvaluationAdvice(server, local) {
  if (!local) return server;
  if (!server) return local;
  const byId = new Map((local.checks || []).map((check) => [check.id, check]));
  return {
    passed: server.passed,
    stars: server.stars,
    checks: (server.checks || []).map((check) => {
      const match = byId.get(check.id);
      return { ...check, label: match?.label || check.label, advice: match?.advice };
    }),
  };
}

const IMAGE_NAMES = {
  "cat-1": "猫图 1", "cat-2": "猫图 2", "dog-1": "狗图 1", "dog-2": "狗图 2",
  "mystery-cat": "神秘图片", "mystery-dog": "校园小狗",
};

const CLASS_NAMES = { cat: "猫", dog: "狗" };

function className(value) {
  return CLASS_NAMES[value] || value;
}

/** label(ids 未达标) → 「猫图 1→猫」清单 */
function labelTodoList(expected, labels) {
  return Object.entries(expected)
    .filter(([imageId, category]) => labels.get(imageId) !== category)
    .map(([imageId, category]) => `${IMAGE_NAMES[imageId] || imageId}→${className(category)}`)
    .join("、");
}

function countsByClass(required, trace) {
  const counts = new Map(required.map((item) => [item, 0]));
  trace.filter((event) => event.type === "LABEL").forEach((event) => {
    if (counts.has(event.category)) counts.set(event.category, counts.get(event.category) + 1);
  });
  return counts;
}

function countsText(counts) {
  return [...counts.entries()].map(([cls, count]) => `${className(cls)} ${count} 张`).join("、");
}

function missionChecks(mission, trace) {
  const config = mission?.runtimeConfig || {};
  const template = mission?.templateCode || mission?.id;

  if (template === "DATA_LABELING" || mission?.id === "label-training-data") {
    const expected = config.expectedLabels || {
      "cat-1": "cat", "cat-2": "cat", "dog-1": "dog", "dog-2": "dog",
    };
    const required = config.requiredClasses || ["cat", "dog"];
    const labels = new Map(
      trace.filter((event) => event.type === "LABEL").map((event) => [event.imageId, event.category]),
    );
    const correctLabels = Object.entries(expected)
      .filter(([imageId, category]) => labels.get(imageId) === category).length;
    const expectedCount = Object.keys(expected).length;
    const todo = labelTodoList(expected, labels);
    const missingClasses = required.filter((item) => ![...labels.values()].includes(item));
    const trainEvent = trace.find((event) => event.type === "TRAIN");
    return [
      {
        id: "labels",
        label: `${expectedCount} 张图片的标签全部正确`,
        passed: correctLabels === expectedCount,
        advice: correctLabels === expectedCount ? undefined : `还有 ${expectedCount - correctLabels} 张没贴对：${todo}。从「AI 数据」再拖一块「__ 是 __」，下拉里选图片、选它是猫还是狗`,
      },
      {
        id: "classes",
        label: "训练数据里猫和狗都要有",
        passed: required.every((item) => [...labels.values()].includes(item)),
        advice: missingClasses.length ? `还缺「${missingClasses.map(className).join("」「")}」的图片，用「__ 是 __」把那一类也教给 AI 吧` : undefined,
      },
      {
        id: "train",
        label: "接上「教 AI 认识这些图片」并运行",
        passed: !config.requireTrain || Boolean(trainEvent?.success),
        advice: !trainEvent
          ? "从「AI 能力」拖「教 AI 认识这些图片」，接在后面"
          : (!trainEvent.success ? "训练失败：AI 至少要见过 2 类图片，检查一下「__ 是 __」摆对了吗" : undefined),
      },
    ];
  }

  if (template === "PREDICTION_BRANCH" || mission?.id === "predict-and-decide") {
    const imageId = config.imageId || "mystery-cat";
    const expected = config.expectedCategory || "cat";
    const keyword = config.messageKeyword || "猫";
    const prediction = [...trace].reverse().find((event) => event.type === "PREDICT");
    const condition = trace.find((event) => event.type === "CONDITION");
    return [
      {
        id: "train",
        label: "先接「教 AI 认识这些图片」",
        passed: !config.requireTrain || trace.some((event) => event.type === "TRAIN" && event.success),
        advice: "从「AI 能力」拖「教 AI 认识这些图片」，放在最前面",
      },
      {
        id: "predict",
        label: `用「让 AI 猜」猜一猜${IMAGE_NAMES[imageId] || "目标图片"}`,
        passed: prediction?.imageId === imageId && prediction?.prediction === expected,
        advice: !prediction
          ? "从「AI 能力」拖「让 AI 猜」，下拉选「神秘图片」"
          : (prediction.prediction === "unknown" ? "猜之前要先「教 AI 认识这些图片」，不然 AI 猜不出来" : undefined),
      },
      {
        id: "condition",
        label: `用「如果」判断结果，说出带「${keyword}」的答案`,
        passed: Boolean(condition?.matched && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword))),
        advice: !condition
          ? `从「判断」拖「如果」积木，判断口放「AI 猜的是 ${className(expected)}」`
          : "在「如果」里面放「说」积木，句子要带「猫」，比如「这是猫」",
      },
    ];
  }

  if (template === "LOOP_ROUTE" || mission?.id === "repeat-a-route") {
    const minRepeat = Number(config.minRepeatTimes || 2);
    const minDistance = Number(config.minDistance || 8);
    const keyword = config.messageKeyword || "任务完成";
    const distance = trace.filter((event) => event.type === "MOVE")
      .reduce((total, event) => total + Number(event.steps || 0), 0);
    return [
      {
        id: "repeat",
        label: "使用「重复 N 次」循环积木",
        passed: trace.some((event) => event.type === "REPEAT" && event.times >= minRepeat),
        advice: "从「循环」拖「重复 N 次」，把「往前走」放进循环里面，别一块一块拖很多次",
      },
      {
        id: "distance",
        label: `机器人累计前进至少 ${minDistance} 步`,
        passed: distance >= minDistance,
        advice: `现在只前进了 ${distance} 步，还差 ${Math.max(0, minDistance - distance)} 步 — 点一下循环上的数字，把重复次数调大`,
      },
      {
        id: "finish",
        label: `到达后说「${keyword}」`,
        passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)),
        advice: "循环后面接「说」积木，输入「任务完成」",
      },
    ];
  }

  if (template === "CONFIDENCE_GATE" || mission?.id === "confidence-gate") {
    const threshold = Number(config.minimumThreshold || 80);
    const keyword = config.messageKeyword || "很有把握";
    const prediction = [...trace].reverse().find((event) => event.type === "PREDICT");
    const condition = trace.find((event) => event.type === "CONFIDENCE_CONDITION");
    return [
      {
        id: "predict",
        label: "先教 AI，再猜神秘图片",
        passed: Boolean(prediction?.prediction && prediction.prediction !== "unknown"),
        advice: "先「教 AI 认识这些图片」，再「让 AI 猜」选「神秘图片」",
      },
      {
        id: "threshold",
        label: `「如果」里放「AI 至少有 ${threshold}% 把握」`,
        passed: Boolean(condition?.threshold >= threshold),
        advice: !condition
          ? `从「判断」拖「如果」，判断口放「AI 至少有 ${threshold}% 把握」`
          : `点一下「如果」里的数字，把门槛调到至少 ${threshold}%`,
      },
      {
        id: "answer",
        label: `条件成立时说「${keyword}」`,
        passed: Boolean(condition?.matched && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword))),
        advice: "在「如果」里面放「说」积木，输入「我很有把握」",
      },
    ];
  }

  if (template === "AGENT_PATROL" || mission?.id === "campus-ai-patrol") {
    const imageId = config.imageId || "mystery-dog";
    const expected = config.expectedCategory || "dog";
    const minRepeat = Number(config.minRepeatTimes || 2);
    const minDistance = Number(config.minDistance || 8);
    const keyword = config.messageKeyword || "巡检完成";
    const prediction = [...trace].reverse().find((event) => event.type === "PREDICT");
    const condition = trace.find((event) => event.type === "CONDITION" && event.expected === expected);
    const distance = trace.filter((event) => event.type === "MOVE")
      .reduce((total, event) => total + Number(event.steps || 0), 0);
    const actParts = [];
    if (distance < minDistance) actParts.push(`还差 ${minDistance - distance} 步，把循环重复次数调大`);
    if (!trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword))) actParts.push(`最后说「${keyword}」`);
    return [
      {
        id: "sense",
        label: `先教 AI，再猜「${IMAGE_NAMES[imageId] || "目标图片"}」`,
        passed: prediction?.imageId === imageId && prediction?.prediction === expected,
        advice: "先「教 AI 认识这些图片」，再「让 AI 猜」下拉选「校园小狗」",
      },
      {
        id: "decide",
        label: `「如果 AI 猜的是 ${className(expected)}」里放循环前进`,
        passed: Boolean(condition?.matched && trace.some((event) => event.type === "REPEAT" && event.times >= minRepeat)),
        advice: !condition
          ? `从「判断」拖「如果」，判断口放「AI 猜的是 ${className(expected)}」`
          : "在「如果」里面放「重复 N 次」，循环里再放「往前走」",
      },
      {
        id: "act",
        label: `累计前进至少 ${minDistance} 步并说「${keyword}」`,
        passed: distance >= minDistance && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)),
        advice: actParts.join("；") || undefined,
      },
    ];
  }

  if (template === "DATA_BALANCE" || mission?.id === "balance-training-data") {
    const required = config.requiredClasses || ["cat", "dog"];
    const minSamples = Number(config.minSamplesPerClass || 2);
    const maxDifference = Number(config.maxDifference ?? 0);
    const counts = countsByClass(required, trace);
    const values = [...counts.values()];
    const keyword = config.messageKeyword || "数据要均衡";
    const checkedBalance = trace.some((event) => event.type === "BALANCE_CHECK");
    const shortClasses = [...counts.entries()].filter(([, count]) => count < minSamples);
    return [
      {
        id: "samples",
        label: `每个类别至少有 ${minSamples} 个样本`,
        passed: values.every((count) => count >= minSamples),
        advice: `现在${countsText(counts)}（共 ${trace.filter((event) => event.type === "LABEL").length} 张）— 从「AI 数据」再拖一块「__ 是 __」，把「${shortClasses.map(([cls]) => className(cls)).join("」「") || "每一类"}」补到 ${minSamples} 张`,
      },
      {
        id: "balance",
        label: "接「看看猫和狗是不是一样多」，两类数量相等",
        passed: checkedBalance && Math.max(...values) - Math.min(...values) <= maxDifference,
        advice: !checkedBalance
          ? "从「公平检查」拖「看看猫和狗是不是一样多」，接在后面"
          : `猫狗数量还不一样多（${countsText(counts)}），让两类一样多再运行`,
      },
      {
        id: "fairness",
        label: `用「说」积木说出「${keyword}」`,
        passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)),
        advice: `从「表达」拖「说」积木，把文字改成「${keyword}」再运行`,
      },
    ];
  }

  if (template === "QUIZ_GAME" || mission?.id === "ai-knowledge-quiz") {
    const expected = config.expectedAnswers || ["b", "b", "a"];
    const answers = new Map(trace.filter((event) => event.type === "QUIZ_ANSWER")
      .map((event) => [event.questionId, event.answer]));
    const score = expected.reduce((total, answer, index) => (
      total + (answers.get(`q${index + 1}`) === answer ? 1 : 0)
    ), 0);
    const passScore = Number(config.passScore || 3);
    const unanswered = expected.map((_, index) => index + 1).filter((n) => !answers.has(`q${n}`));
    const wrong = expected.map((answer, index) => (answers.get(`q${index + 1}`) !== answer ? index + 1 : null)).filter(Boolean);
    return [
      {
        id: "answered",
        label: "三道题都要答（3 块「第 __ 题我选 __」）",
        passed: answers.size === 3,
        advice: unanswered.length ? `还差第 ${unanswered.join("、")} 题：从「知识闯关」拖一块「第 __ 题我选 __」，下拉选题号` : undefined,
      },
      {
        id: "score",
        label: `答对至少 ${passScore} 道题`,
        passed: score >= passScore,
        advice: wrong.length ? `第 ${wrong.join("、")} 题不对 — 点上方「需要提示」看正确答案` : undefined,
      },
      {
        id: "submit",
        label: "接「交卷，看能得几分」",
        passed: trace.some((event) => event.type === "QUIZ_SUBMIT"),
        advice: "答题积木后面接「交卷，看能得几分」，才能拿到分数",
      },
    ];
  }

  if (template === "SEQUENCE_STORY" || mission?.id === "ai-sequence-story") {
    const required = config.requiredScenes || ["classroom", "lab", "future"];
    const sceneNames = { classroom: "AI 教室", lab: "AI 实验室", future: "未来城市" };
    const scenes = trace.filter((event) => event.type === "SCENE").map((event) => event.sceneId);
    let cursor = 0;
    scenes.forEach((scene) => {
      if (required[cursor] === scene) cursor += 1;
    });
    const minWait = Number(config.minWaitSeconds || 1);
    let pacedScenes = 0;
    let validWaitSeen = false;
    for (const event of trace) {
      if (event.type === "WAIT" && pacedScenes > 0 && Number(event.seconds) >= minWait) validWaitSeen = true;
      if (event.type === "SCENE" && required[pacedScenes] === event.sceneId) {
        if (pacedScenes > 0 && !validWaitSeen) break;
        pacedScenes += 1;
        validWaitSeen = false;
      }
    }
    const keyword = config.messageKeyword || "故事结束";
    const remaining = required.slice(cursor).map((scene) => sceneNames[scene] || scene);
    return [
      {
        id: "scenes",
        label: "按 教室→实验室→未来城市 顺序切换场景",
        passed: cursor === required.length,
        advice: remaining.length ? `还差场景：${remaining.join("→")}（从「绘本故事」拖「去 …」，按顺序接好）` : undefined,
      },
      {
        id: "pace",
        label: "每个场景后接「等 _ 秒」再切下一个",
        passed: pacedScenes === required.length,
        advice: "在两个「去 …」中间放一块「等 1 秒」，让观众看完画面",
      },
      {
        id: "ending",
        label: `最后说「${keyword}」`,
        passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)),
        advice: "故事最后接「说」积木，输入「故事结束」",
      },
    ];
  }

  return [];
}

/**
 * 「示范程序」：每关的满分程序（Blockly 序列化 JSON），一键摆进工作区。
 * 仅使用各关卡服务端白名单内的积木类型（保存时 rejectDisallowedBlocks 校验）。
 */
const DEMO_PROGRAM_SPECS = {
  "label-training-data": [
    { t: "k12_label_image", f: { IMAGE: "cat-1", CATEGORY: "cat" } },
    { t: "k12_label_image", f: { IMAGE: "cat-2", CATEGORY: "cat" } },
    { t: "k12_label_image", f: { IMAGE: "dog-1", CATEGORY: "dog" } },
    { t: "k12_label_image", f: { IMAGE: "dog-2", CATEGORY: "dog" } },
    { t: "k12_train_classifier" },
  ],
  "predict-and-decide": [
    { t: "k12_train_classifier" },
    { t: "k12_predict_image", f: { IMAGE: "mystery-cat" } },
    {
      t: "controls_if",
      cond: { t: "k12_prediction_equals", f: { CATEGORY: "cat" } },
      body: [{ t: "k12_say", f: { MESSAGE: "这是猫" } }],
    },
  ],
  "repeat-a-route": [
    { t: "controls_repeat_ext", times: 4, body: [{ t: "k12_move", f: { STEPS: 2 } }] },
    { t: "k12_say", f: { MESSAGE: "任务完成" } },
  ],
  "confidence-gate": [
    { t: "k12_train_classifier" },
    { t: "k12_predict_image", f: { IMAGE: "mystery-cat" } },
    {
      t: "controls_if",
      cond: { t: "k12_confidence_at_least", f: { THRESHOLD: 80 } },
      body: [{ t: "k12_say", f: { MESSAGE: "我很有把握" } }],
    },
  ],
  "campus-ai-patrol": [
    { t: "k12_train_classifier" },
    { t: "k12_predict_image", f: { IMAGE: "mystery-dog" } },
    {
      t: "controls_if",
      cond: { t: "k12_prediction_equals", f: { CATEGORY: "dog" } },
      body: [
        { t: "controls_repeat_ext", times: 4, body: [{ t: "k12_move", f: { STEPS: 2 } }] },
        { t: "k12_say", f: { MESSAGE: "巡检完成" } },
      ],
    },
  ],
  "balance-training-data": [
    { t: "k12_label_image", f: { IMAGE: "cat-1", CATEGORY: "cat" } },
    { t: "k12_label_image", f: { IMAGE: "cat-2", CATEGORY: "cat" } },
    { t: "k12_label_image", f: { IMAGE: "dog-1", CATEGORY: "dog" } },
    { t: "k12_label_image", f: { IMAGE: "dog-2", CATEGORY: "dog" } },
    { t: "k12_check_balance" },
    { t: "k12_say", f: { MESSAGE: "数据要均衡" } },
  ],
  "ai-knowledge-quiz": [
    { t: "k12_quiz_answer", f: { QUESTION: "q1", ANSWER: "b" } },
    { t: "k12_quiz_answer", f: { QUESTION: "q2", ANSWER: "b" } },
    { t: "k12_quiz_answer", f: { QUESTION: "q3", ANSWER: "a" } },
    { t: "k12_submit_quiz" },
  ],
  "ai-sequence-story": [
    { t: "k12_switch_scene", f: { SCENE: "classroom" } },
    { t: "k12_wait", f: { SECONDS: 1 } },
    { t: "k12_switch_scene", f: { SCENE: "lab" } },
    { t: "k12_wait", f: { SECONDS: 1 } },
    { t: "k12_switch_scene", f: { SCENE: "future" } },
    { t: "k12_say", f: { MESSAGE: "故事结束" } },
  ],
};

function buildDemoChain(specs, prefix) {
  let first = null;
  let cursor = null;
  specs.forEach((spec, index) => {
    const id = `${prefix}${index}`;
    const block = { type: spec.t, id };
    if (spec.f) block.fields = spec.f;
    const inputs = {};
    if (spec.times) inputs.TIMES = { shadow: { type: "math_number", fields: { NUM: spec.times } } };
    if (spec.cond) inputs.IF0 = { block: { type: spec.cond.t, fields: spec.cond.f, id: `${id}c` } };
    // controls_repeat_ext 的循环体输入叫 DO（controls_if 才是 DO0），挂错名字反序列化会失败
    if (spec.body?.length) {
      inputs[spec.t === "controls_repeat_ext" ? "DO" : "DO0"] = { block: buildDemoChain(spec.body, `${id}b`) };
    }
    if (Object.keys(inputs).length) block.inputs = inputs;
    if (!first) {
      first = block;
    } else {
      cursor.next = { block };
    }
    cursor = block;
  });
  return first;
}

/** 返回本关示范程序的序列化 JSON（无示范定义时返回 null）。 */
export function demoProgramFor(missionOrId) {
  const mission = typeof missionOrId === "string"
    ? findBlocklyMission(missionOrId)
    : normalizeMission(missionOrId);
  const specs = DEMO_PROGRAM_SPECS[mission?.missionCode || mission?.id];
  if (!specs?.length) return null;
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: "k12_when_start", id: "demo-start", x: 40, y: 40, deletable: false,
        next: { block: buildDemoChain(specs, "d") },
      }],
    },
  };
}
