/** 学习台主题目录：按类型分组，浅色标注。 */

export const TOPIC_CATEGORIES = [
  {
    id: "picture-books",
    label: "互动绘本",
    blurb: "听故事、看图片、做挑战",
    tone: "sand",
  },
  {
    id: "algorithm",
    label: "算法入门",
    blurb: "排序、查找与步骤",
    tone: "sky",
  },
  {
    id: "ml",
    label: "机器学习",
    blurb: "数据、模型与评估",
    tone: "mint",
  },
  {
    id: "genai",
    label: "生成式 AI",
    blurb: "提问、风险与诚信",
    tone: "sand",
  },
  {
    id: "data",
    label: "数据与隐私",
    blurb: "认识数据并保护自己",
    tone: "leaf",
  },
  {
    id: "systems",
    label: "可信 AI 应用",
    blurb: "Embedding、RAG 与智能体",
    tone: "sky",
  },
];

export const TEACHING_TOPICS = [
  {
    id: "cat-picture-book",
    category: "picture-books",
    label: "AI 为什么能认出小猫",
    hint: "绘本朗读 + 图片分类游戏",
    route: "cat-lesson",
    audiences: ["primary"],
  },
  {
    id: "what-is-algorithm",
    category: "algorithm",
    label: "什么是算法",
    hint: "步骤讲解 + 小测",
    prompt: "什么是算法？",
  },
  {
    id: "loop-basics",
    category: "algorithm",
    label: "循环与重复",
    hint: "步骤讲解 + 小测",
    prompt: "循环与重复是什么？",
  },
  {
    id: "bubble-sort",
    category: "algorithm",
    label: "冒泡排序",
    hint: "条形动画 + 小测",
    prompt: "冒泡排序怎么做？",
  },
  {
    id: "selection-sort",
    category: "algorithm",
    label: "选择排序",
    hint: "条形动画 + 小测",
    prompt: "选择排序怎么做？",
  },
  {
    id: "insertion-sort",
    category: "algorithm",
    label: "插入排序",
    hint: "条形动画 + 小测",
    prompt: "插入排序怎么做？",
  },
  {
    id: "linear-search",
    category: "algorithm",
    label: "线性查找",
    hint: "条形动画 + 小测",
    prompt: "线性查找怎么做？",
  },
  {
    id: "binary-search",
    category: "algorithm",
    label: "二分查找",
    hint: "条形动画 + 小测",
    prompt: "二分查找怎么做？",
  },
  {
    id: "features-labels",
    category: "ml",
    label: "特征与标签",
    hint: "逐步讲解 + 小测",
    prompt: "特征和标签是什么？",
  },
  {
    id: "supervised-learning",
    category: "ml",
    label: "监督学习",
    hint: "逐步讲解 + 小测",
    prompt: "监督学习是什么？",
  },
  {
    id: "classification-regression",
    category: "ml",
    label: "分类与回归",
    hint: "逐步讲解 + 小测",
    prompt: "分类和回归有什么区别？",
  },
  {
    id: "image-classification",
    category: "ml",
    label: "图像分类",
    hint: "逐步讲解 + 小测",
    prompt: "图像分类怎么学？",
  },
  {
    id: "object-detection",
    category: "ml",
    label: "AI 怎样找到图片里的物体",
    hint: "找位置 + 画框 + 小测",
    prompt: "物体检测是什么？",
    code: "computer_vision.object_detection",
  },
  {
    id: "train-test",
    category: "ml",
    label: "训练集与测试集",
    hint: "逐步讲解 + 小测",
    prompt: "训练集和测试集有什么区别？",
  },
  {
    id: "neural-network",
    category: "ml",
    label: "神经网络入门",
    hint: "逐步讲解 + 小测",
    prompt: "神经网络是什么？",
  },
  {
    id: "overfitting",
    category: "ml",
    label: "过拟合",
    hint: "逐步讲解 + 小测",
    prompt: "过拟合是什么？",
  },
  {
    id: "data-bias",
    category: "ml",
    label: "数据偏差",
    hint: "逐步讲解 + 小测",
    prompt: "数据偏差是什么？",
  },
  {
    id: "prompt-basics",
    category: "genai",
    label: "提示词入门",
    hint: "逐步讲解 + 小测",
    prompt: "提示词入门怎么学？",
  },
  {
    id: "hallucination",
    category: "genai",
    label: "AI 幻觉",
    hint: "逐步讲解 + 小测",
    prompt: "AI 幻觉是什么？",
  },
  {
    id: "responsible-ai",
    category: "genai",
    label: "负责任使用 AI",
    hint: "逐步讲解 + 小测",
    prompt: "生成式 AI 应该如何安全使用？",
  },
  {
    id: "copyright-originality",
    category: "genai",
    label: "版权与原创",
    hint: "逐步讲解 + 小测",
    prompt: "版权与原创要注意什么？",
  },
  {
    id: "what-is-data",
    category: "data",
    label: "什么是数据",
    hint: "逐步讲解 + 小测",
    prompt: "什么是数据？",
  },
  {
    id: "privacy-basics",
    category: "data",
    label: "隐私保护",
    hint: "逐步讲解 + 小测",
    prompt: "隐私保护要注意什么？",
  },
  {
    id: "embedding-intro",
    category: "systems",
    label: "Embedding 向量表示",
    hint: "高中 · 逐步讲解 + 小测",
    prompt: "Embedding 向量表示是什么？",
    audiences: ["teen"],
  },
  {
    id: "rag-basics",
    category: "systems",
    label: "RAG 检索增强生成",
    hint: "高中 · 证据流程 + 小测",
    prompt: "RAG 检索增强生成怎么工作？",
    audiences: ["teen"],
  },
  {
    id: "agent-basics",
    category: "systems",
    label: "智能体目标与工具",
    hint: "高中 · 流程设计 + 小测",
    prompt: "AI 智能体怎样使用目标、工具和反馈？",
    audiences: ["teen"],
  },
];

export function topicsByCategory(audience) {
  return TOPIC_CATEGORIES.map((category) => ({
    ...category,
    topics: TEACHING_TOPICS.filter((topic) => (
      topic.category === category.id
      && (!audience || !topic.audiences || topic.audiences.includes(audience))
    )),
  })).filter((group) => group.topics.length > 0);
}

const TOPIC_CODES = Object.freeze({
  "image-classification": "machine_learning.image_classification",
  "object-detection": "computer_vision.object_detection",
  "train-test": "machine_learning.train_test_split",
  "neural-network": "machine_learning.neural_network_basics",
  "supervised-learning": "machine_learning.supervised_learning",
});

export function topicCodeForId(topicId) {
  const topic = TEACHING_TOPICS.find((item) => item.id === topicId);
  return topic?.code || TOPIC_CODES[topicId] || null;
}

export function topicIdForKnowledgeCode(code) {
  if (!code) return null;
  const topic = TEACHING_TOPICS.find((item) => (item.code || TOPIC_CODES[item.id]) === code);
  return topic?.id || null;
}
