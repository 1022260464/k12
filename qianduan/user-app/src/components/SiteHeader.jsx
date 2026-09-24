import { GraduationCap, LogOut, Menu, Shapes, X } from "lucide-react";
import { useState } from "react";
import { HeaderSearch } from "./HeaderSearch.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import { EXPERIENCE, experienceNavigation, learningProfileLabel } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

export function SiteHeader({
  page,
  session,
  displayName,
  avatarUrl,
  navigate,
  requireLogin,
  onAskKnowledge,
  onOpenProfile,
  onLogin,
  onRegister,
  onLogout,
  experience,
  learningProfile,
  onExperienceChange,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  function go(nextPage) { navigate(nextPage); setMenuOpen(false); }
  const initial = (displayName || "同").slice(0, 1).toUpperCase();
  const navigation = experienceNavigation[experience] || experienceNavigation[EXPERIENCE.TEEN];
  const brandMascot = visualsFor(experience).mascot;

  return (
    <header className={`site-header${session ? " authenticated" : ""}`}>
      <button className="brand brand-button" type="button" onClick={() => go("home")} aria-label="返回学习首页">
        <span className="brand-mark"><img src={brandMascot} alt="" /></span><span>EduGraph AI</span>
      </button>
      <div className="experience-switcher" role="group" aria-label="切换学生端界面">
        <button
          className={experience === EXPERIENCE.PRIMARY ? "active" : ""}
          type="button"
          title="切换到小学端"
          aria-pressed={experience === EXPERIENCE.PRIMARY}
          onClick={() => onExperienceChange(EXPERIENCE.PRIMARY)}
        >
          <Shapes size={15} />小学端
        </button>
        <button
          className={experience === EXPERIENCE.TEEN ? "active" : ""}
          type="button"
          title="切换到初高中端"
          aria-pressed={experience === EXPERIENCE.TEEN}
          onClick={() => onExperienceChange(EXPERIENCE.TEEN)}
        >
          <GraduationCap size={15} />初高中端
        </button>
        {learningProfile?.schoolStage && (
          <span className="profile-stage-chip" title="当前学习档案">{learningProfileLabel(learningProfile)}</span>
        )}
      </div>
      <nav className={menuOpen ? "open" : ""} aria-label="主导航">
        {navigation.map(([id, label]) => (
          <button className={page === id ? "active" : ""} type="button" key={id} onClick={() => go(id)}>{label}</button>
        ))}
      </nav>
      <div className="header-actions">
        <HeaderSearch
          session={session}
          requireLogin={requireLogin}
          navigate={navigate}
          onAskKnowledge={onAskKnowledge}
        />
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
