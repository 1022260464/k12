import { BookOpenText, Code2, FileCheck2, FlaskConical, Languages, Target } from "lucide-react";

export const courses = [
  { title: "AI 小侦探：机器怎样认识世界", subject: "人工智能", grade: "小学低年级", progress: 0, next: "AI 为什么能认出小猫", lessons: "互动绘本与分类挑战", icon: BookOpenText, image: "/assets/experience/primary/student-explorer.webp" },
  { title: "图形化编程小创客", subject: "人工智能", grade: "小学高年级", progress: 0, next: "用积木搭出智能任务", lessons: "8 个闯关任务", icon: Code2, image: "/assets/experience/primary/code-laptop.webp" },
  { title: "Python 程序设计", subject: "信息科技", grade: "七至九年级", progress: 72, next: "循环结构与列表", lessons: "12 / 16 课时", icon: Code2, image: "/assets/course-code-comic.png" },
  { title: "数学思维探索", subject: "数学", grade: "七年级", progress: 46, next: "一元一次方程", lessons: "8 / 18 课时", icon: Target, image: "/assets/course-math-comic.png" },
  { title: "科学探究实验", subject: "科学", grade: "八年级", progress: 31, next: "控制变量法", lessons: "5 / 16 课时", icon: FlaskConical, image: "/assets/course-science-comic.png" },
  { title: "英语阅读进阶", subject: "英语", grade: "七年级", progress: 58, next: "校园主题阅读", lessons: "7 / 12 课时", icon: Languages, image: "/assets/course-reading-comic.png" },
  { title: "AI 与知识地图", subject: "拓展课程", grade: "八至九年级", progress: 20, next: "认识分类模型", lessons: "2 / 10 课时", icon: BookOpenText, image: "/assets/k12-ai-learning-journey.png" },
  { title: "构建可信 AI 应用", subject: "人工智能", grade: "高中", progress: 0, next: "Embedding 与相似度", lessons: "RAG 与智能体项目", icon: FlaskConical, image: "/assets/k12-ai-learning-journey.png" },
];

export const tasks = [
  { title: "完成条件判断练习", course: "Python 程序设计", meta: "10 道题 · 约 15 分钟", due: "今天 18:00", state: "进行中", icon: FileCheck2 },
  { title: "复习一元一次方程", course: "数学思维探索", meta: "错题巩固 · 约 12 分钟", due: "今天 20:00", state: "待完成", icon: Target },
  { title: "提交科学实验记录", course: "科学探究实验", meta: "实验报告 · 约 25 分钟", due: "明天 20:00", state: "待提交", icon: FlaskConical },
  { title: "完成校园主题阅读", course: "英语阅读进阶", meta: "阅读理解 · 8 道题", due: "本周五", state: "待完成", icon: Languages },
];

// 推荐位兜底内容：不再是虚构示例，而是平台上真实发布的课程。
// id 对应 learning_course 主键，登录后点击会直接打开课程详情；文案取自各课真实简介。
export const realShowcaseCourses = [
  { id: 7, title: "人工智能启蒙：机器如何认识世界", subject: "人工智能通识", grade: "小学低年级", next: "从身边的智能设备认识 AI", image: "/assets/k12-ai-learning-journey.png" },
  { id: 18, title: "AI 小侦探：机器怎样认识世界", subject: "人工智能", grade: "小学低年级", next: "从小猫图片开始的 AI 感知闭环", image: "/assets/experience/primary/student-explorer.webp" },
  { id: 22, title: "信息生活小达人：交流与安全", subject: "信息科技", grade: "小学低年级", next: "信息交流、隐私与安全（课标对齐）", image: "/assets/experience/primary/books/book-password-guardian.webp" },
  { id: 8, title: "图形化编程与智能小车", subject: "编程与机器人", grade: "小学高年级", next: "顺序、分支、循环驱动机器人任务", image: "/assets/experience/primary/code-laptop.webp" },
  { id: 23, title: "身边的算法与智能控制", subject: "信息科技", grade: "小学高年级", next: "从排队、查找等生活算法入门（课标对齐）", image: "/assets/experience/primary/books/book-algo-cart.webp" },
  { id: 9, title: "Python与人工智能基础", subject: "Python编程", grade: "初中", next: "从数据处理到分类、训练与评价", image: "/assets/course-code-comic.png" },
  { id: 19, title: "从数据到模型：训练集、测试集与准确率", subject: "人工智能", grade: "初中", next: "用可复现实验理解准确率", image: "/assets/experience/primary/books/book-data-speaks.webp" },
  { id: 24, title: "互联网应用与创新", subject: "信息科技", grade: "初中", next: "一次网页打开背后的完整链路（课标对齐）", image: "/assets/course-science-comic.png" },
  { id: 25, title: "人工智能与智慧社会", subject: "信息科技", grade: "初中", next: "身边的 AI 到数据、训练与伦理（课标对齐）", image: "/assets/k12-ai-learning-journey.png" },
  { id: 10, title: "机器学习项目实践", subject: "人工智能项目", grade: "高中", next: "数据、训练、评价到项目报告全流程", image: "/assets/course-code-comic.png" },
  { id: 20, title: "构建可信 AI 应用：Embedding、RAG 与智能体", subject: "人工智能", grade: "高中", next: "向量检索、引用忠实度与人工确认", image: "/assets/k12-ai-learning-journey.png" },
];
