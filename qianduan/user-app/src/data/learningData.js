import { BookOpenText, Code2, FileCheck2, FlaskConical, Languages, Target } from "lucide-react";

export const courses = [
  { title: "Python 程序设计", subject: "信息科技", grade: "七至九年级", progress: 72, next: "循环结构与列表", lessons: "12 / 16 课时", icon: Code2, image: "/assets/course-code-comic.png" },
  { title: "数学思维探索", subject: "数学", grade: "七年级", progress: 46, next: "一元一次方程", lessons: "8 / 18 课时", icon: Target, image: "/assets/course-math-comic.png" },
  { title: "科学探究实验", subject: "科学", grade: "八年级", progress: 31, next: "控制变量法", lessons: "5 / 16 课时", icon: FlaskConical, image: "/assets/course-science-comic.png" },
  { title: "英语阅读进阶", subject: "英语", grade: "七年级", progress: 58, next: "校园主题阅读", lessons: "7 / 12 课时", icon: Languages, image: "/assets/course-reading-comic.png" },
  { title: "AI 与知识地图", subject: "拓展课程", grade: "八至九年级", progress: 20, next: "认识分类模型", lessons: "2 / 10 课时", icon: BookOpenText, image: "/assets/k12-ai-learning-journey.png" },
];

export const tasks = [
  { title: "完成条件判断练习", course: "Python 程序设计", meta: "10 道题 · 约 15 分钟", due: "今天 18:00", state: "进行中", icon: FileCheck2 },
  { title: "复习一元一次方程", course: "数学思维探索", meta: "错题巩固 · 约 12 分钟", due: "今天 20:00", state: "待完成", icon: Target },
  { title: "提交科学实验记录", course: "科学探究实验", meta: "实验报告 · 约 25 分钟", due: "明天 20:00", state: "待提交", icon: FlaskConical },
  { title: "完成校园主题阅读", course: "英语阅读进阶", meta: "阅读理解 · 8 道题", due: "本周五", state: "待完成", icon: Languages },
];
