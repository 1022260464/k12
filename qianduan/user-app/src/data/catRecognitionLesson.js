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
  if (step === "game") return 85;
  if (step === "code") return 68;
  if (step === "explain") return 55;
  if (step === "book") return 10 + Math.round(((pageIndex + 1) / catPictureBook.pages.length) * 35);
  return 0;
}

/** 课堂内编程小任务：把「教 AI 认猫」的步骤排成程序。 */
export const catCommandGame = {
  eyebrow: "编程小任务 · 教电脑做事",
  title: "把「教 AI 认小猫」的步骤排排队",
  intro: "电脑照着程序，一步一步地做事情。你能把小智认猫的四个步骤排成正确的顺序吗？",
  successText: "排对啦！这一串步骤就是一个小程序——电脑就是这样一步步认出小猫的。",
  hint: "小提示：小智得先看到图片，才能开始找线索哦。",
  steps: [
    { id: "look", emoji: "👀", label: "仔细看图片" },
    { id: "clue", emoji: "🔍", label: "找出线索：耳朵、胡须、花纹" },
    { id: "match", emoji: "🧠", label: "用学过的规律比对线索" },
    { id: "answer", emoji: "📣", label: "说出答案：它是小猫！" },
  ],
};

/** 小智讲解失败时的离线讲解词。 */
export const fallbackExplainText = `小猫有**尖尖的耳朵、圆圆的眼睛和长长的胡须**，这些就是 AI 要找的**线索**。

AI 先看很多很多带名字的图片（比如"这是小猫""这是小狗"），记住每一类动物最常出现的线索。再来一张新图片时，它就把新线索和记住的规律比一比，猜出最合适的标签。

不过 AI 也会猜错：照片太暗、太模糊，或者只见过白色小猫却遇到黑色小猫，都可能出错。所以我们要像小侦探一样**核对它的答案**。`;

/** Agent 生成失败时的内置离线题目：本地判分，保证课堂不中断。 */
export const fallbackPictureQuiz = {
  local: true,
  instructions: "看图选一选：它属于哪个标签盒？",
  questions: [
    {
      id: "q1",
      prompt: "这位新朋友是谁？",
      visual: { kind: "text", value: "🐱" },
      options: [{ id: "a", text: "小猫" }, { id: "b", text: "小狗" }],
      answer: "a",
      hint: "尖尖的耳朵和长长的胡须，是小猫的招牌线索。",
    },
    {
      id: "q2",
      prompt: "这一位呢？",
      visual: { kind: "text", value: "🐶" },
      options: [{ id: "a", text: "小猫" }, { id: "b", text: "小狗" }],
      answer: "b",
      hint: "它会汪汪叫，还喜欢摇尾巴。",
    },
    {
      id: "q3",
      prompt: "看花纹和个头，它是谁？",
      visual: { kind: "text", value: "🐯" },
      options: [{ id: "a", text: "老虎" }, { id: "b", text: "小猫" }],
      answer: "a",
      hint: "身上有大条纹、个头很大，不是家里的小猫。",
    },
    {
      id: "q4",
      prompt: "最后一关！它是？",
      visual: { kind: "text", value: "🐰" },
      options: [{ id: "a", text: "小兔" }, { id: "b", text: "小猫" }],
      answer: "a",
      hint: "长长的耳朵和三瓣嘴，是小兔才有的。",
    },
  ],
};

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
