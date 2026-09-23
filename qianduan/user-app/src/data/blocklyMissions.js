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
    hint: "从“AI 数据”中拖出 4 个贴标签积木，选择正确分类，再接上训练分类器。",
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
    hint: "依次连接训练、预测、如果积木；把“预测结果是猫”放进如果的判断位置。",
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
    hint: "把“前进 2 步”放进重复 4 次里，然后在循环后连接说话积木。",
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
    hint: "依次连接训练、预测和如果；把“预测置信度至少 80%”放进如果，再在里面放说话积木。",
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
    hint: "训练后预测校园小狗，把循环移动和说“巡检完成”都放在“如果预测结果是狗”里面。",
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
    hint: "各放两个猫、狗标签积木，再连接“检查数据是否均衡”和说话积木。",
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
    hint: "连接三块答题积木：第 1 题选 B、第 2 题选 B、第 3 题选 A，最后提交。",
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
    hint: "每次切换场景后让角色说一句话；前两幕之后连接等待积木，最后说结束语。",
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

/** 本地即时评分：按 templateCode + runtimeConfig。 */
export function evaluateBlocklyMission(missionOrId, trace = []) {
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
    return [
      { id: "labels", label: `${expectedCount} 张图片的标签全部正确`, passed: correctLabels === expectedCount },
      { id: "classes", label: `训练数据覆盖所需类别`, passed: required.every((item) => [...labels.values()].includes(item)) },
      { id: "train", label: "完成分类器训练", passed: !config.requireTrain || trace.some((event) => event.type === "TRAIN" && event.success) },
    ];
  }

  if (template === "PREDICTION_BRANCH" || mission?.id === "predict-and-decide") {
    const imageId = config.imageId || "mystery-cat";
    const expected = config.expectedCategory || "cat";
    const keyword = config.messageKeyword || "猫";
    const prediction = [...trace].reverse().find((event) => event.type === "PREDICT");
    const condition = trace.find((event) => event.type === "CONDITION");
    return [
      { id: "train", label: "先训练分类器", passed: !config.requireTrain || trace.some((event) => event.type === "TRAIN" && event.success) },
      { id: "predict", label: "预测目标图片", passed: prediction?.imageId === imageId && prediction?.prediction === expected },
      { id: "condition", label: "用条件判断并说出答案", passed: Boolean(condition?.matched && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword))) },
    ];
  }

  if (template === "LOOP_ROUTE" || mission?.id === "repeat-a-route") {
    const minRepeat = Number(config.minRepeatTimes || 2);
    const minDistance = Number(config.minDistance || 8);
    const keyword = config.messageKeyword || "任务完成";
    const distance = trace.filter((event) => event.type === "MOVE")
      .reduce((total, event) => total + Number(event.steps || 0), 0);
    return [
      { id: "repeat", label: "使用循环积木", passed: trace.some((event) => event.type === "REPEAT" && event.times >= minRepeat) },
      { id: "distance", label: `机器人累计前进至少 ${minDistance} 步`, passed: distance >= minDistance },
      { id: "finish", label: "到达后宣布任务完成", passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)) },
    ];
  }

  if (template === "CONFIDENCE_GATE" || mission?.id === "confidence-gate") {
    const threshold = Number(config.minimumThreshold || 80);
    const keyword = config.messageKeyword || "很有把握";
    const prediction = [...trace].reverse().find((event) => event.type === "PREDICT");
    const condition = trace.find((event) => event.type === "CONFIDENCE_CONDITION");
    return [
      { id: "predict", label: "训练后完成一次预测", passed: Boolean(prediction?.prediction && prediction.prediction !== "unknown") },
      { id: "threshold", label: `设置至少 ${threshold}% 的置信度门槛`, passed: Boolean(condition?.threshold >= threshold) },
      { id: "answer", label: "条件成立后自信回答", passed: Boolean(condition?.matched && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword))) },
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
    return [
      { id: "sense", label: "识别目标图片", passed: prediction?.imageId === imageId && prediction?.prediction === expected },
      { id: "decide", label: "判断结果并使用循环", passed: Boolean(condition?.matched && trace.some((event) => event.type === "REPEAT" && event.times >= minRepeat)) },
      { id: "act", label: `前进至少 ${minDistance} 步并报告完成`, passed: distance >= minDistance && trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)) },
    ];
  }

  if (template === "DATA_BALANCE" || mission?.id === "balance-training-data") {
    const required = config.requiredClasses || ["cat", "dog"];
    const minSamples = Number(config.minSamplesPerClass || 2);
    const maxDifference = Number(config.maxDifference ?? 0);
    const counts = new Map(required.map((item) => [item, 0]));
    trace.filter((event) => event.type === "LABEL").forEach((event) => {
      if (counts.has(event.category)) counts.set(event.category, counts.get(event.category) + 1);
    });
    const values = [...counts.values()];
    const keyword = config.messageKeyword || "数据要均衡";
    return [
      { id: "samples", label: `每个类别至少有 ${minSamples} 个样本`, passed: values.every((count) => count >= minSamples) },
      { id: "balance", label: `检查数据且类别数量差不超过 ${maxDifference}`, passed: trace.some((event) => event.type === "BALANCE_CHECK") && Math.max(...values) - Math.min(...values) <= maxDifference },
      { id: "fairness", label: "说明数据均衡与公平性", passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)) },
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
    return [
      { id: "answered", label: "完成全部 3 道题", passed: answers.size === 3 },
      { id: "score", label: `答对至少 ${passScore} 道题`, passed: score >= passScore },
      { id: "submit", label: "提交答案并查看反馈", passed: trace.some((event) => event.type === "QUIZ_SUBMIT") },
    ];
  }

  if (template === "SEQUENCE_STORY" || mission?.id === "ai-sequence-story") {
    const required = config.requiredScenes || ["classroom", "lab", "future"];
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
    return [
      { id: "scenes", label: "按顺序切换全部故事场景", passed: cursor === required.length },
      { id: "pace", label: "场景之间保留阅读时间", passed: pacedScenes === required.length },
      { id: "ending", label: "完成故事并说出结束语", passed: trace.some((event) => event.type === "SAY" && String(event.message || "").includes(keyword)) },
    ];
  }

  return [];
}
