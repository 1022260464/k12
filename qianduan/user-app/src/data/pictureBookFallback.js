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

export function normalizePictureBook(book) {
  if (!book) return null;
  return { ...book, pages: normalizedPages(Array.isArray(book.pages) ? book.pages : []) };
}

export function fallbackPictureBook(code) {
  return fallbackPictureBooks.find((book) => book.bookCode === code) || null;
}
