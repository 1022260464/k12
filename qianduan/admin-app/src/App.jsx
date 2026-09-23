import { useEffect, useRef, useState } from "react";
import { Activity, Bot, BookOpen, BookOpenCheck, Blocks, ChevronDown, ClipboardCheck, FileCheck2, LayoutDashboard, LogOut, Menu, Network, PanelLeftClose, ScrollText, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { clearSession, getSession, profileApi, rolesApi } from "./api/client.js";
import { AdminNotificationBell } from "./components/AdminNotificationBell.jsx";
import { ProfileModal } from "./components/ProfileModal.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RoleManagement } from "./pages/RoleManagement.jsx";
import { UserManagement } from "./pages/UserManagement.jsx";
import { AuditManagement } from "./pages/AuditManagement.jsx";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { TeacherOverviewPage } from "./pages/TeacherOverviewPage.jsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.jsx";
import { ResourceManagement } from "./pages/ResourceManagement.jsx";
import { TeachingResourceManagement } from "./pages/TeachingResourceManagement.jsx";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage.jsx";
import { VisualProgrammingMissionManagement } from "./pages/VisualProgrammingMissionManagement.jsx";
import { PictureBookManagement } from "./pages/PictureBookManagement.jsx";
import { StudentLearningEvidencePage } from "./pages/StudentLearningEvidencePage.jsx";

const BRAND_ICON = "/assets/brand-face-doodle.png";

const navigation = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "users", label: "用户管理", icon: Users, adminOnly: true },
  { id: "roles", label: "角色说明", icon: ShieldCheck, adminOnly: true },
  { id: "courses", label: "课程资源", icon: BookOpen, permission: "course:read" },
  { id: "materials", label: "教学资料", icon: FileCheck2, permission: "course:create" },
  { id: "knowledge", label: "知识图谱", icon: Network, permission: "course:read" },
  { id: "visual-programming", label: "图形化关卡", icon: Blocks, adminOnly: true },
  { id: "picture-books", label: "绘本审核", icon: BookOpenCheck, adminOnly: true },
  { id: "agents", label: "智能体管理", icon: Bot, adminOnly: true },
  { id: "homeworks", label: "作业管理", icon: ClipboardCheck, permission: "homework:read" },
  { id: "learning-evidence", label: "学习证据", icon: Activity, permission: "homework:grade" },
  { id: "audits", label: "安全审计", icon: ScrollText, adminOnly: true },
  { id: "settings", label: "系统设置", icon: Settings, adminOnly: true },
];

export function App() {
  const [session, setSession] = useState(getSession);
  const [page, setPage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [toast, setToast] = useState(null);
  const [profile, setProfile] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef(null);
  const isAdmin = session?.authorities?.includes("ROLE_ADMIN");
  const visibleNavigation = navigation.filter((item) => isAdmin || (!item.adminOnly && (!item.permission || session?.authorities?.includes(item.permission))));
  const currentPage = visibleNavigation.some((item) => item.id === page) ? page : "overview";
  const displayName = profile?.nickname || profile?.username || session?.username || "用户";
  const initial = displayName.slice(0, 1).toUpperCase();
  const pageLabel = visibleNavigation.find((item) => item.id === currentPage)?.label;

  function notify(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    if (!session || !isAdmin) return;
    rolesApi.list().then(setRoles).catch((error) => {
      if (error.status === 401) {
        setSession(null);
        return;
      }
      notify(error.message, "error");
    });
  }, [session, isAdmin]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setShowProfile(false);
      return undefined;
    }
    let alive = true;
    profileApi.getSelf()
      .then((self) => {
        if (alive) setProfile(self);
      })
      .catch((error) => {
        if (error.status === 401) setSession(null);
      });
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleLogout() {
    clearSession();
    setMenuOpen(false);
    setShowProfile(false);
    setProfile(null);
    setSession(null);
  }

  function openProfile() {
    setShowProfile(true);
    setMenuOpen(false);
    setSidebarOpen(false);
  }

  function renderPage() {
    if (currentPage === "overview") return isAdmin ? <OverviewPage notify={notify} onNavigate={setPage} /> : <TeacherOverviewPage onNavigate={setPage} notify={notify} />;
    if (currentPage === "users") return <UserManagement roles={roles} notify={notify} />;
    if (currentPage === "roles") return <RoleManagement roles={roles} setRoles={setRoles} notify={notify} />;
    if (["courses", "agents", "homeworks"].includes(currentPage)) return <ResourceManagement resource={currentPage} isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "materials") return <TeachingResourceManagement isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "knowledge") return <KnowledgeGraphPage isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "visual-programming") return <VisualProgrammingMissionManagement notify={notify} />;
    if (currentPage === "picture-books") return <PictureBookManagement notify={notify} />;
    if (currentPage === "learning-evidence") return <StudentLearningEvidencePage notify={notify} />;
    if (currentPage === "audits") return <AuditManagement notify={notify} />;
    return <PlaceholderPage title="系统设置" description="通知策略、全局参数和配置中心管理尚无对应后端接口。" />;
  }

  if (!session) return <LoginPage onLogin={setSession} />;

  return (
    <main className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <a className="brand" href="/">
            <span className="brand-mark"><img src={BRAND_ICON} alt="" /></span>
            <span>{isAdmin ? "平台管理中心" : "教师工作台"}</span>
          </a>
          <button className="icon-button sidebar-close" type="button" title="关闭导航" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={19} />
          </button>
        </div>
        <nav className="side-nav" aria-label="管理端导航">
          {visibleNavigation.map(({ icon: Icon, ...item }) => (
            <button
              className={currentPage === item.id ? "active" : ""}
              type="button"
              key={item.id}
              title={item.label}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            >
              <Icon size={19} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <button className="sidebar-user-main" type="button" onClick={openProfile} title="个人中心">
            <span className="admin-avatar">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initial}
            </span>
            <div>
              <strong>{displayName}</strong>
              <small>{isAdmin ? "系统管理员" : "教师"}</small>
            </div>
          </button>
          <button className="icon-button dark" type="button" title="退出登录" onClick={handleLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <button className="icon-button top-menu" type="button" title="打开导航" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>{isAdmin ? "管理中心" : "教学工作台"}</span>
            <strong>/</strong>
            <span>{pageLabel}</span>
          </div>
          <div className="top-actions">
            <span className="environment"><i />开发环境</span>
            <AdminNotificationBell isAdmin={isAdmin} onNavigate={setPage} />
            <div className={`top-user-menu ${menuOpen ? "open" : ""}`} ref={menuRef}>
              <button
                className="top-user-button"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title="账号菜单"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="top-avatar">
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initial}
                </span>
                <span className="top-user-name">{displayName}</span>
                <ChevronDown size={16} />
              </button>
              {menuOpen && (
                <div className="top-user-dropdown" role="menu">
                  <button type="button" role="menuitem" onClick={openProfile}>
                    <UserRound size={16} />个人中心
                  </button>
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={16} />退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {renderPage()}
      </div>
      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setSidebarOpen(false)}><X /></button>}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
      {showProfile && (
        <ProfileModal
          session={session}
          isAdmin={isAdmin}
          notify={notify}
          onClose={() => setShowProfile(false)}
          onProfileUpdated={setProfile}
        />
      )}
    </main>
  );
}
