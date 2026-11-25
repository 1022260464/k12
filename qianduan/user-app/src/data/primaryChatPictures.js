// 小学端「问问小智」的图画素材：开场卡与回答插图共用一套映射，
// 图优先复用互动绘本封面，孩子看到同一张画就能想起同一个故事。

const BOOKS = "/assets/experience/primary/books";

/** 开场卡：点一下就把问题交给小智（topicCode 让回答与学习证据都落在课程知识点上）。 */
export const primaryChatStarters = [
  {
    id: "cats",
    image: "/assets/experience/primary/student-reading.webp",
    label: "AI 认小猫",
    question: "AI 是怎么认出小猫的？",
    topicCode: "machine_learning.image_classification",
  },
  {
    id: "ears",
    image: `${BOOKS}/book-little-ears.webp`,
    label: "小智的耳朵",
    question: "小智没有耳朵，是怎么听见我说话的？",
    topicCode: "ai_overview.ai_perception",
  },
  {
    id: "password",
    image: `${BOOKS}/book-password-guardian.webp`,
    label: "密码小卫士",
    question: "什么样的密码才结实？",
    topicCode: "digital_citizenship.password_hygiene",
  },
  {
    id: "loops",
    image: `${BOOKS}/book-algo-cart.webp`,
    label: "积木小车",
    question: "重复积木是怎么让小车一圈圈跑的？",
    topicCode: "computing.loop_basics",
  },
  {
    id: "charts",
    image: `${BOOKS}/book-data-speaks.webp`,
    label: "数据会说话",
    question: "柱状图的高矮在告诉我们什么？",
    topicCode: "data_literacy.charts_basics",
  },
  {
    id: "what-is-ai",
    image: "/assets/experience/primary/ai-brain.webp",
    label: "AI 是什么",
    question: "什么是人工智能？",
    topicCode: "ai_overview.what_is_ai",
  },
];

const RULES = [
  { match: /小猫|认出|照片|图片识别|图像分类/, src: "/assets/experience/primary/student-reading.webp", alt: "小智和学生一起看图片找线索", caption: "看看小智怎么找图片线索" },
  { match: /听见|说话|声音|耳朵|语音/, src: `${BOOKS}/book-little-ears.webp`, alt: "小智侧着头听声波和音符", caption: "《小智的耳朵》里画过哦" },
  { match: /密码|账号|安全/, src: `${BOOKS}/book-password-guardian.webp`, alt: "小智和学生守卫平板电脑", caption: "《密码小卫士》里画过哦" },
  { match: /循环|重复|积木|小车/, src: `${BOOKS}/book-algo-cart.webp`, alt: "积木小车在环形轨道上跑", caption: "《积木小车》里画过哦" },
  { match: /柱状|扇形|图表|统计|数据图/, src: `${BOOKS}/book-data-speaks.webp`, alt: "会说话的柱状图和扇形图", caption: "《数据会说话》里画过哦" },
  { match: /人工智能|什么是 ?ai|AI 是什么|机器学习/, src: "/assets/experience/primary/ai-brain.webp", alt: "亮着灯的 AI 大脑", caption: "这就是 AI 的小脑袋" },
  { match: /机器人/, src: "/assets/experience/primary/mascot-wave.webp", alt: "小智在挥手", caption: "小智就是一个机器人朋友" },
  { match: /天空|蓝色|彩虹|天气|为什么.*颜色/, src: "/assets/experience/primary/science-flask.webp", alt: "彩色实验瓶", caption: "用小实验找答案" },
];

/**
 * 给一轮回答配一张图：先看话题码，再按问题关键词猜；
 * 都猜不中就返回 null，不硬塞图。
 */
export function primaryPictureFor({ text = "", topicCode } = {}) {
  const byCode = primaryChatStarters.find((starter) => starter.topicCode === topicCode);
  if (byCode) {
    return { src: byCode.image, alt: `${byCode.label}的插图`, caption: `看看：${byCode.label}` };
  }
  const hit = RULES.find((rule) => rule.match.test(text));
  return hit ? { src: hit.src, alt: hit.alt, caption: hit.caption } : null;
}

// 小测选项/引导按钮的关键词 emoji：认字不全的孩子先看图标再认字。
const EMOJI_RULES = [
  [/重复|循环|再来|一圈又一圈/, "🔁"],
  [/只做一次|永远|停|休息/, "🛑"],
  [/画画|绘画|涂色|美术|画画/, "🎨"],
  [/删除|丢掉|扔|垃圾/, "🗑️"],
  [/步骤|顺序|一步一步|排队/, "🪜"],
  [/电脑|程序|代码|编程/, "💻"],
  [/随机|乱猜|猜一猜/, "🎲"],
  [/小猫|猫/, "🐱"],
  [/小狗|狗/, "🐶"],
  [/耳朵|听见|声音|语音/, "👂"],
  [/说话|告诉|讲/, "🗣️"],
  [/密码|锁|账号/, "🔐"],
  [/柱状|图表|统计|高矮/, "📊"],
  [/扇形|蛋糕|圆形图/, "🍰"],
  [/积木|小车|轨道/, "🚗"],
  [/机器人|小智/, "🤖"],
  [/大脑|智能|聪明|思考|想/, "🧠"],
  [/苹果/, "🍎"],
  [/香蕉/, "🍌"],
  [/图片|照片|看图/, "🖼️"],
  [/学习|上课|读书|课本/, "📚"],
  [/游戏|玩一玩|小游戏/, "🎮"],
  [/挑战|任务|闯关/, "🎯"],
  [/故事|绘本|听一个/, "📖"],
  [/问题|提问|还有吗/, "❓"],
  [/安全|保护|守护/, "🛡️"],
  [/数据|数字|数量|数一数/, "🔢"],
  [/星星|奖励|表扬|棒/, "⭐"],
  [/颜色|红色|蓝色|涂/, "🌈"],
  [/错误|错|不对|猜错/, "❌"],
  [/正确|对的|答对/, "✅"],
];

/** 按关键词取一个 emoji，没有合适的就返回空串（宁缺毋滥）。 */
export function primaryEmojiFor(text) {
  const value = String(text || "");
  const hit = EMOJI_RULES.find(([pattern]) => pattern.test(value));
  return hit ? hit[1] : "";
}
