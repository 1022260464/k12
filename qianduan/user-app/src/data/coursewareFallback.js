export const COURSEWARE_MIME = "application/vnd.k12.courseware.v1+json";

export const fallbackCoursewares = [
  {
    coursewareId: "demo-image-classification",
    title: "AI 怎样认出小猫",
    stage: "lower_primary",
    slideCount: 6,
    localDemo: true,
    document: {
      title: "AI 怎样认出小猫",
      slides: [
        {
          type: "cover",
          title: "AI 怎样认出小猫",
          subtitle: "从图片、标签到一次小小的预测",
        },
        {
          type: "concept",
          title: "机器先要学会看线索",
          bullets: [
            "图片在机器眼里是一组数字。",
            "耳朵、轮廓、颜色和纹理都可以成为线索。",
            "人先给图片贴上正确标签，机器才知道该学什么。",
          ],
          narration: "机器会把图片变成数字，再从很多带标签的图片里寻找线索。",
        },
        {
          type: "example",
          title: "一次预测是怎样发生的",
          body: "先看一张新图片，再提取特征，接着和学过的样子比较，最后输出“猫”或“狗”的名称和把握度。",
          narration: "先看图片，再找特征，比较以后输出结果。",
        },
        {
          type: "quiz",
          question: "AI 认猫时，最需要下面哪一种材料？",
          options: ["很多带标签的图片", "一张空白纸", "一段随机音乐"],
          answer: 0,
          explanation: "图片提供样子，标签告诉 AI 每一张图片是什么。",
        },
        {
          type: "quiz",
          question: "AI 说“猫，90%”表示什么？",
          options: ["猫有九成重", "AI 有九成把握", "图片只加载了九成"],
          answer: 1,
          explanation: "把握度表示模型对这次判断有多确信。",
        },
        {
          type: "summary",
          title: "带走三句话",
          points: [
            "图片和标签是机器学习的材料。",
            "模型会从线索中寻找规律。",
            "AI 会猜错，结果仍需要人来检查。",
          ],
          narration: "图片和标签是学习材料，模型寻找规律，结果需要人来检查。",
        },
      ],
    },
  },
  {
    coursewareId: "demo-model-evaluation",
    title: "训练集、测试集与准确率",
    stage: "middle_school",
    slideCount: 5,
    localDemo: true,
    document: {
      title: "训练集、测试集与准确率",
      slides: [
        {
          type: "cover",
          title: "模型真的学会了吗？",
          subtitle: "用训练、测试和准确率回答",
        },
        {
          type: "concept",
          title: "为什么要分成两组数据",
          bullets: [
            "训练集用来让模型学习。",
            "测试集用来检查模型遇到新数据时是否可靠。",
            "用训练过的题考试，不能证明真正学会。",
          ],
          narration: "训练集让模型学习，测试集检查模型遇到新数据时的表现。",
        },
        {
          type: "example",
          title: "准确率怎么计算",
          body: "测试 20 张图片，答对 16 张。准确率 = 16 ÷ 20 = 80%。准确率必须说明在哪个测试集上得到。",
          narration: "测试二十张图片，答对十六张，准确率就是百分之八十。",
        },
        {
          type: "quiz",
          question: "哪一个结果更能说明模型泛化能力？",
          options: ["训练集 100%", "独立测试集 82%", "只记住了答案"],
          answer: 1,
          explanation: "独立测试集没有参与训练，更能反映遇到新数据时的表现。",
        },
        {
          type: "summary",
          title: "实验记录",
          points: [
            "写清训练集和测试集如何划分。",
            "准确率必须带测试样本数量。",
            "一次结果不能代替重复实验。",
          ],
        },
      ],
    },
  },
];

export function normalizeCourseware(item) {
  if (!item) return null;
  const document = item.document?.slides
    ? item.document
    : item.payload?.slides
      ? item.payload
      : null;
  return {
    ...item,
    document,
    slideCount: item.slideCount || document?.slides?.length || 0,
  };
}
