// 一二年级专用左侧导航：顶部栏放不下的入口搬到这里，图大字少，
// 孩子认图不认字也能找到要去的地方。其他学段不渲染，顶部导航保持原样。
const NAV_ITEMS = [
  { id: "home", label: "首页", image: "/assets/experience/primary/mascot-wave.webp" },
  { id: "ai-studio", label: "问问小智", image: "/assets/experience/primary/ai-brain.webp" },
  { id: "picture-books", label: "互动绘本", image: "/assets/experience/primary/student-reading.webp" },
  { id: "courses", label: "探索课程", image: "/assets/experience/primary/student-explorer.webp" },
  { id: "tasks", label: "趣味任务", image: "/assets/experience/primary/goal-mountain.webp" },
  { id: "visual-code-lab", label: "图形编程", image: "/assets/experience/primary/code-laptop.webp" },
  { id: "coursewares", label: "AI 课件", image: "/assets/experience/primary/books.webp" },
  { id: "leaderboard", label: "成长排行", image: "/assets/experience/primary/achievement-trophy.webp" },
  { id: "progress", label: "我的成长", image: "/assets/experience/primary/chat-star.webp" },
];

export function PrimarySideNav({ page, navigate }) {
  return (
    <aside className="primary-side-nav" aria-label="学习导航">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={page === item.id ? "active" : ""}
          onClick={() => navigate(item.id)}
        >
          <img src={item.image} alt="" loading="lazy" />
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
