import { LogOut, Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell.jsx";

const navigation = [
  ["home", "学习首页"],
  ["ai-studio", "AI 学习台"],
  ["courses", "课程中心"],
  ["tasks", "作业练习"],
  ["code-lab", "编程实验"],
  ["leaderboard", "学习排行"],
  ["progress", "学习报告"],
];

export function SiteHeader({ page, session, displayName, avatarUrl, navigate, onOpenProfile, onLogin, onRegister, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  function go(nextPage) { navigate(nextPage); setMenuOpen(false); }
  const initial = (displayName || "同").slice(0, 1).toUpperCase();

  return (
    <header className="site-header">
      <button className="brand brand-button" type="button" onClick={() => go("home")} aria-label="返回学习首页">
        <span className="brand-mark"><img src="/assets/brand-face-doodle.png" alt="" /></span><span>EduGraph AI</span>
      </button>
      <nav className={menuOpen ? "open" : ""} aria-label="主导航">
        {navigation.map(([id, label]) => (
          <button className={page === id ? "active" : ""} type="button" key={id} onClick={() => go(id)}>{label}</button>
        ))}
      </nav>
      <div className="header-actions">
        <label className="header-search"><Search size={16} /><input aria-label="搜索" placeholder="搜索课程、知识点、题目" /></label>
        {session ? (
          <div className="user-menu">
            <NotificationBell session={session} navigate={navigate} />
            <button
              className="avatar-button"
              type="button"
              title="个人设置与学习档案"
              onClick={() => { onOpenProfile?.(); setMenuOpen(false); }}
            >
              {avatarUrl ? <img className="avatar-img" src={avatarUrl} alt="" /> : <span className="avatar">{initial}</span>}
            </button>
            <button className="user-name-button" type="button" title="个人设置" onClick={() => { onOpenProfile?.(); setMenuOpen(false); }}>
              {displayName}
            </button>
            <button className="icon-button" type="button" title="退出登录" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        ) : (
          <>
            <button className="header-login" type="button" onClick={onLogin}>登录</button>
            <button className="header-register" type="button" onClick={onRegister}>注册</button>
          </>
        )}
        <button className="icon-button mobile-menu" type="button" title="菜单" onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
    </header>
  );
}
