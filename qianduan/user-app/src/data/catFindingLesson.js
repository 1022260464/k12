export const FIND_CAT_KNOWLEDGE_CODE = "computer_vision.object_detection";

/** 第二课全离线：绘本、编程任务、题目都使用固定种子数据，保证演示链路可重复。 */
export const findCatPictureBook = {
  schemaVersion: "1.0",
  title: "找到小猫在哪里",
  reviewStatus: "APPROVED",
  pages: [
    {
      pageNo: 1,
      image: "/assets/experience/primary/student-explorer.webp",
      alt: "小学生拿着放大镜在图片里寻找小猫",
      title: "小猫玩捉迷藏",
      narration: "小猫在照片里躲了起来。只会分类的 AI 只能说「这张图里有猫」，可猫妈妈想问的是：猫到底在哪个位置？",
      prompt: "你能在心里指出小猫躲在哪个角落吗？",
    },
    {
      pageNo: 2,
      image: "/assets/experience/primary/ai-brain.webp",
      alt: "人工智能给图片里的小猫画出一个方框",
      title: "给小猫画一个框",
      narration: "AI 找到小猫以后，会用一个方框把它圈出来，框的旁边写上名字，还有一个表示「有多大把握」的数字。",
      prompt: "框旁边的 90% 是什么意思呢？",
    },
    {
      pageNo: 3,
      image: "/assets/experience/primary/mascot-wave.webp",
      alt: "小智提醒大家一张图里可能有多个目标",
      title: "一个框可不够",
      narration: "如果照片里有一只猫和一只狗，AI 要画两个框，分别写上名字。分类只回答「是什么」，找位置还要回答「在哪里」。",
      prompt: "三只小猫捉迷藏，要画几个框？",
    },
    {
      pageNo: 4,
      image: "/assets/experience/primary/goal-mountain.webp",
      alt: "找到位置以后可以完成更多任务",
      title: "找位置的本领很大",
      narration: "过马路时要找到汽车在哪里，翻绘本时要找到小猫在哪一页。学会了「在哪里」，AI 就能帮上更多忙。",
      prompt: "下一关，你来当找小猫的小侦探！",
    },
  ],
};

export const findCatCommandGame = {
  eyebrow: "编程小任务 · 教电脑找猫",
  title: "把「找小猫」的步骤排排队",
  intro: "找位置和认东西不一样：电脑要先看整张图，再一块一块仔细找。来排出正确的步骤吧！",
  successText: "排对啦！这就是一个「找物体」的小程序：先看整体，再找位置，最后写名字。",
  hint: "小提示：还没看整张图就急着画框，可找不到小猫哦。",
  steps: [
    { id: "scan", emoji: "🖼️", label: "先看整张图片" },
    { id: "divide", emoji: "🧩", label: "把图片分成小块，挨个找线索" },
    { id: "frame", emoji: "📦", label: "发现小猫，画一个框圈住它" },
    { id: "label", emoji: "🏷️", label: "写上名字和把握度" },
  ],
};

export const findCatQuiz = {
  local: true,
  instructions: "找小猫游戏：选一选，怎样在图片里找到小猫。",
  questions: [
    {
      id: "f1",
      prompt: "AI 找到小猫以后，会做什么？",
      visual: { kind: "text", value: "🐱📦" },
      options: [{ id: "a", text: "画一个框把猫圈起来" }, { id: "b", text: "把这张图片删掉" }, { id: "c", text: "把猫变成小狗" }],
      answer: "a",
      hint: "框框的旁边还会写上名字哦。",
    },
    {
      id: "f2",
      prompt: "框旁边写着「90%」，这是什么意思？",
      visual: { kind: "text", value: "🐱 90%" },
      options: [{ id: "a", text: "小猫有九成重" }, { id: "b", text: "AI 有九成把握这是猫" }, { id: "c", text: "图片加载了九成" }],
      answer: "b",
      hint: "把握越大，数字就越接近 100%。",
    },
    {
      id: "f3",
      prompt: "图片里有一只猫和一只狗，AI 要画几个框？",
      visual: { kind: "text", value: "🐱🐶" },
      options: [{ id: "a", text: "1 个" }, { id: "b", text: "2 个" }, { id: "c", text: "0 个" }],
      answer: "b",
      hint: "每个小伙伴都要有自己的框。",
    },
    {
      id: "f4",
      prompt: "哪件事必须先知道「在哪里」才能做？",
      visual: { kind: "text", value: "🚸🚗" },
      options: [{ id: "a", text: "数一数今天星期几" }, { id: "b", text: "唱一首好听的歌" }, { id: "c", text: "过马路前找到汽车的位置" }],
      answer: "c",
      hint: "想一想走在斑马线前的时候。",
    },
  ],
};

export function findCatProgress(step, pageIndex = 0) {
  if (step === "reward") return 100;
  if (step === "game") return 85;
  if (step === "code") return 68;
  if (step === "book") return 10 + Math.round(((pageIndex + 1) / findCatPictureBook.pages.length) * 35);
  return 0;
}
