import { catPictureBook } from "./catRecognitionLesson.js";

function normalizedPages(pages) {
  return pages.map((page) => ({
    ...page,
    imageUrl: page.imageUrl || page.image,
    altText: page.altText || page.alt,
  }));
}

export const fallbackPictureBooks = [
  {
    bookCode: "ai-recognizes-cats",
    title: catPictureBook.title,
    subtitle: "图片、标签与机器的第一次观察",
    summary: "跟着小智认识图片线索、标签和分类，并理解 AI 也会猜错。",
    stageCode: "PRIMARY_LOWER",
    knowledgeCode: "machine_learning.image_classification",
    coverUrl: catPictureBook.pages[0].image,
    challengeType: "CAT_LESSON",
    challengeReference: "cat-recognition",
    status: "PUBLISHED",
    pages: normalizedPages(catPictureBook.pages),
  },
  {
    bookCode: "fair-picture-team",
    title: "每张图片都要被看见",
    subtitle: "小智的公平训练队",
    summary: "通过猫狗图片数量差异认识数据均衡、模型偏差和负责任的人工智能。",
    stageCode: "PRIMARY_LOWER",
    knowledgeCode: "data_literacy.bias_in_data",
    coverUrl: "/assets/experience/primary/student-thinker.webp",
    challengeType: "VISUAL_MISSION",
    challengeReference: "balance-training-data",
    status: "PUBLISHED",
    pages: normalizedPages([
      { pageNo: 1, title: "照片篮子不一样大", narration: "小智准备学习认识猫和狗，可是猫照片装满了一大篮，狗照片只有一张。", prompt: "如果你是小智，会不会更熟悉照片更多的那一类？", image: "/assets/experience/primary/books.webp", alt: "一大篮猫照片和一张狗照片" },
      { pageNo: 2, title: "偏心不是小智故意的", narration: "小智不是故意偏心。它只能从看到的例子中学习，例子太少的一类就更容易猜错。", prompt: "问题可能来自模型，也可能来自我们准备的数据。", image: "/assets/experience/primary/ai-brain.webp", alt: "小智观察数量不均衡的训练图片" },
      { pageNo: 3, title: "补齐不同的例子", narration: "同学们补充了不同颜色、角度和背景里的猫狗照片，还认真检查每张图片的标签。", prompt: "数量更均衡只是开始，图片还要足够丰富。", image: "/assets/experience/primary/student-explorer.webp", alt: "学生为训练集补充多样图片" },
      { pageNo: 4, title: "一起检查才更可靠", narration: "训练完成后，大家用新图片分别测试猫和狗。发现错误时继续记录、核对和改进。", prompt: "公平的 AI 需要合适的数据，也需要人持续检查。", image: "/assets/experience/primary/achievement-trophy.webp", alt: "学生和小智一起检查分类结果" },
    ]),
  },
];

export const extraFallbackBooks = [
  {
    bookCode: "password-guardian",
    title: "密码小卫士",
    subtitle: "小智教我的第一个安全密码",
    summary: "跟小智学会保护自己的账号：什么样的密码最结实，密码能不能告诉别人。",
    stageCode: "PRIMARY_LOWER",
    knowledgeCode: "digital_citizenship.password_hygiene",
    coverUrl: "/assets/experience/primary/books/book-password-guardian.webp",
    challengeType: "AI_TOPIC",
    challengeReference: "数字公民与密码安全",
    status: "PUBLISHED",
    pages: normalizedPages([
      { pageNo: 1, title: "小智的新朋友", narration: "乐乐有一台平板电脑。小智说：里面的世界，需要一把看不见的锁来保护。", prompt: "猜一猜：看不见的锁是什么呀？", image: "/assets/experience/primary/books/book-password-guardian.webp", alt: "小机器人和小朋友一起守卫平板电脑" },
      { pageNo: 2, title: "看不见的锁", narration: "这把锁就是密码。只有乐乐知道的秘密词语，别人猜不到，就打不开乐乐的账号。", prompt: "你的密码只有谁知道呢？", image: "/assets/experience/primary/ai-brain.webp", alt: "小智解释密码像一把看不见的锁" },
      { pageNo: 3, title: "结实的密码", narration: "小乐试着造了一把结实的锁：把喜欢的动物、数字和符号连起来，又长又特别。", prompt: "试试连一连：小猫＋数字＋符号，会变成什么？", image: "/assets/experience/primary/goal-mountain.webp", alt: "用动物数字符号拼出结实密码的插画" },
      { pageNo: 4, title: "密码不告诉别人", narration: "小智悄悄话：密码不告诉别人，除了爸爸妈妈。生日和名字当密码，坏人一下子就能猜到哦。", prompt: "记住啦？跟小智拉个钩：保护好我的密码！", image: "/assets/experience/primary/mascot-wave.webp", alt: "小智提醒密码不能告诉别人" },
    ]),
  },
  {
    bookCode: "little-ears",
    title: "小智的耳朵",
    subtitle: "机器是怎么听见我说话的",
    summary: "跟小智发现声音的小秘密：声音变成图案跳进机器，机器再把它变回话。",
    stageCode: "PRIMARY_LOWER",
    knowledgeCode: "ai_overview.ai_perception",
    coverUrl: "/assets/experience/primary/books/book-little-ears.webp",
    challengeType: "AI_TOPIC",
    challengeReference: "语音与感知智能",
    status: "PUBLISHED",
    pages: normalizedPages([
      { pageNo: 1, title: "小智听见了", narration: "乐乐说：小智你好呀！小智没有耳朵，却听清楚了。它是怎么做到的？", prompt: "没有耳朵，也能听见吗？", image: "/assets/experience/primary/books/book-little-ears.webp", alt: "小机器人侧头倾听声波与音符" },
      { pageNo: 2, title: "声音的小图案", narration: "声音像水波一样荡出去。小智把声波画成一条条弯弯的小图案，收进肚子里。", prompt: "对着空气说句话，声音的波纹会是什么样子？", image: "/assets/experience/primary/science-flask.webp", alt: "声波被画成彩色小图案的插画" },
      { pageNo: 3, title: "找最像的话", narration: "小智翻看学过的话，找和自己收藏的小图案最像的一句：原来你说的是你好呀！", prompt: "说得清楚一点，小智找得就更快！", image: "/assets/experience/primary/student-reading.webp", alt: "小智比对声音图案找最像的一句话" },
      { pageNo: 4, title: "小智也会听错", narration: "旁边小狗汪汪叫，小智可能听错。听错了没关系，再说一遍就好。人说话慢一点，AI 听得更准。", prompt: "去和小智说句话试试，看它听得准不准！", image: "/assets/experience/primary/mascot-wave.webp", alt: "小狗叫时小智听错了，小朋友再说一遍" },
    ]),
  },
  {
    bookCode: "algo-cart",
    title: "积木小车的算法之旅",
    subtitle: "一句话让小车跑一圈又一圈",
    summary: "跟小智用积木指挥小车：先想清楚步骤，再用重复积木让路线一圈圈跑起来。",
    stageCode: "PRIMARY_UPPER",
    knowledgeCode: "computing.loop_basics",
    coverUrl: "/assets/experience/primary/books/book-algo-cart.webp",
    challengeType: "VISUAL_MISSION",
    challengeReference: "repeat-a-route",
    status: "PUBLISHED",
    pages: normalizedPages([
      { pageNo: 1, title: "小车想去环线旅行", narration: "彩色积木小车想去环形轨道旅行。可是它很小，需要有人告诉它每一步怎么走。", prompt: "如果你来指挥，先告诉它什么？", image: "/assets/experience/primary/books/book-algo-cart.webp", alt: "积木小车在环形轨道上等待指令" },
      { pageNo: 2, title: "一步一步写清楚", narration: "前进、转弯、再前进——把每一步按顺序写下来，小车才不会迷路。这就是算法。", prompt: "顺序乱了会怎样？小车会撞墙吗？", image: "/assets/experience/primary/code-laptop.webp", alt: "把前进转弯步骤按顺序排好的插画" },
      { pageNo: 3, title: "重复的秘密", narration: "写十遍前进太累啦！用一块重复积木把路线圈起来，小车就能一圈又一圈地跑。", prompt: "数一数：重复积木帮你少写了几行？", image: "/assets/experience/primary/books/book-algo-cart.webp", alt: "重复积木让小车一圈圈循环行驶" },
      { pageNo: 4, title: "轮到你出发", narration: "改一改重复的次数，换一换转弯的方向，新的旅行路线就出现啦。读完去积木实验室试一试！", prompt: "准备好看你的小车跑起来了吗？", image: "/assets/experience/primary/achievement-trophy.webp", alt: "小朋友改参数设计新路线" },
    ]),
  },
  {
    bookCode: "data-speaks",
    title: "数据会说话",
    subtitle: "图形是小数据的悄悄话",
    summary: "跟小智听图表说话：一根柱子、一块扇形，都是数据在讲自己的故事。",
    stageCode: "PRIMARY_UPPER",
    knowledgeCode: "data_literacy.charts_basics",
    coverUrl: "/assets/experience/primary/books/book-data-speaks.webp",
    challengeType: "AI_TOPIC",
    challengeReference: "数据与图表",
    status: "PUBLISHED",
    pages: normalizedPages([
      { pageNo: 1, title: "会说话的图形", narration: "教室里有四根彩色柱子，它们吵着要说话。小智说：别急，一个一个讲。", prompt: "柱子会讲什么故事呢？", image: "/assets/experience/primary/books/book-data-speaks.webp", alt: "拟人化的彩色柱状图张嘴说话" },
      { pageNo: 2, title: "柱子的高低", narration: "红色柱子最高——喜欢红色的人最多！柱子越高，数量越多。这是柱状图在说话。", prompt: "数数看：最矮的柱子代表几个人？", image: "/assets/experience/primary/books.webp", alt: "高低不同的柱子表示数量多少" },
      { pageNo: 3, title: "圆圆的扇形图", narration: "圆形图表像切开的蛋糕。块越大，那一部分越多。一眼就能看出谁是大头。", prompt: "如果全班都爱吃苹果，蛋糕会变成什么样？", image: "/assets/experience/primary/ai-brain.webp", alt: "扇形图表像切开的蛋糕" },
      { pageNo: 4, title: "图形也会骗人", narration: "小智提醒：图形可以画得很夸张。先看数字、再下结论，别只相信看起来很厉害的图。", prompt: "下次看到图表，记得问它：你的数字是多少？", image: "/assets/experience/primary/student-thinker.webp", alt: "小朋友思考核对图表背后的数字" },
    ]),
  },
];

export function normalizePictureBook(book) {
  if (!book) return null;
  return { ...book, pages: normalizedPages(Array.isArray(book.pages) ? book.pages : []) };
}

export function fallbackPictureBook(code) {
  return [...fallbackPictureBooks, ...extraFallbackBooks].find((book) => book.bookCode === code) || null;
}
