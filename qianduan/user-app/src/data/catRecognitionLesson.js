export const CAT_KNOWLEDGE_CODE = "machine_learning.image_classification";

export const catPictureBook = {
  schemaVersion: "1.0",
  title: "AI 为什么能认出小猫",
  reviewStatus: "APPROVED",
  pages: [
    {
      pageNo: 1,
      image: "/assets/experience/primary/student-reading.webp",
      alt: "小学生打开一本关于小猫的故事书",
      title: "小智的新任务",
      narration: "小智收到一张小猫照片。它想知道：机器没有眼睛，为什么也能认出小猫呢？",
      prompt: "先找找看：你会注意小猫的哪些样子？",
    },
    {
      pageNo: 2,
      image: "/assets/experience/primary/ai-brain.webp",
      alt: "人工智能从图片卡片里寻找线索",
      title: "从很多卡片里学习",
      narration: "老师先给 AI 看很多图片，并告诉它哪些是小猫、哪些是小狗。这些名字叫做标签。",
      prompt: "图片和正确名字放在一起，AI 才知道要学什么。",
    },
    {
      pageNo: 3,
      image: "/assets/experience/primary/science-flask.webp",
      alt: "用不同样子的动物图片做小实验",
      title: "寻找不一样的线索",
      narration: "AI 会从图片里的形状、颜色和纹理寻找规律。不同颜色、角度和背景的图片越丰富，学习越可靠。",
      prompt: "只看过白色小猫，遇到黑色小猫时会怎样？",
    },
    {
      pageNo: 4,
      image: "/assets/experience/primary/mascot-wave.webp",
      alt: "小智提醒大家人工智能也会犯错",
      title: "AI 也会猜错",
      narration: "照片太暗、太模糊，或者训练图片太少时，AI 可能猜错。我们要核对结果，不要把 AI 的答案当成永远正确。",
      prompt: "准备好了吗？接下来去当图片分类小侦探！",
    },
  ],
};

export function lessonProgress(step, pageIndex = 0) {
  if (step === "reward") return 100;
  if (step === "game") return 75;
  if (step === "explain") return 55;
  if (step === "book") return 10 + Math.round(((pageIndex + 1) / catPictureBook.pages.length) * 35);
  return 0;
}

export function fallbackRecommendation(masteryPercent) {
  if (masteryPercent < 60) {
    return {
      code: CAT_KNOWLEDGE_CODE,
      title: "再玩一次猫狗分类",
      reason: "刚才还有容易混淆的地方，再看一组图片会更稳。",
    };
  }
  return {
    code: "computer_vision.object_detection",
    title: "AI 怎样在图片里找到物体",
    reason: "你已经会给整张图片分类，下一步可以学习找出图片里的物体。",
  };
}
