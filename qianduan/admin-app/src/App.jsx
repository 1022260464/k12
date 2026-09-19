import { useEffect, useState } from "react";
import { Bot, BookOpen, ClipboardCheck, FileCheck2, LayoutDashboard, LogOut, Menu, Network, PanelLeftClose, ScrollText, Settings, ShieldCheck, Users, X } from "lucide-react";
import { clearSession, getSession, rolesApi } from "./api/client.js";
import { AdminNotificationBell } from "./components/AdminNotificationBell.jsx";
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

const navigation = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "users", label: "用户管理", icon: Users, adminOnly: true },
  { id: "roles", label: "角色说明", icon: ShieldCheck, adminOnly: true },
  { id: "courses", label: "课程资源", icon: BookOpen, permission: "course:read" },
  { id: "materials", label: "教学资料", icon: FileCheck2, permission: "course:create" },
  { id: "knowledge", label: "知识图谱", icon: Network, permission: "course:read" },
  { id: "agents", label: "智能体管理", icon: Bot, adminOnly: true },
  { id: "homeworks", label: "作业管理", icon: ClipboardCheck, permission: "homework:read" },
  { id: "audits", label: "安全审计", icon: ScrollText, adminOnly: true },
  { id: "settings", label: "系统设置", icon: Settings, adminOnly: true },
];

export function App() {
  const [session, setSession] = useState(getSession);
  const [page, setPage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [toast, setToast] = useState(null);
  const isAdmin = session?.authorities?.includes("ROLE_ADMIN");
  const visibleNavigation = navigation.filter((item) => isAdmin || (!item.adminOnly && (!item.permission || session?.authorities?.includes(item.permission))));
  const currentPage = visibleNavigation.some((item) => item.id === page) ? page : "overview";

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

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  function renderPage() {
    if (currentPage === "overview") return isAdmin ? <OverviewPage notify={notify} onNavigate={setPage} /> : <TeacherOverviewPage onNavigate={setPage} notify={notify} />;
    if (currentPage === "users") return <UserManagement roles={roles} notify={notify} />;
    if (currentPage === "roles") return <RoleManagement roles={roles} setRoles={setRoles} notify={notify} />;
    if (["courses", "agents", "homeworks"].includes(currentPage)) return <ResourceManagement resource={currentPage} isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "materials") return <TeachingResourceManagement isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "knowledge") return <KnowledgeGraphPage isAdmin={isAdmin} notify={notify} />;
    if (currentPage === "audits") return <AuditManagement notify={notify} />;
    return <PlaceholderPage title="系统设置" description="通知策略、全局参数和配置中心管理尚无对应后端接口。" />;
  }

  if (!session) return <LoginPage onLogin={setSession} />;

  return (
    <main className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><a className="brand" href="/"><span className="brand-mark">eg</span><span>{isAdmin ? "平台管理中心" : "教师工作台"}</span></a><button className="icon-button sidebar-close" type="button" title="关闭导航" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={19} /></button></div>
        <nav className="side-nav" aria-label="管理端导航">{visibleNavigation.map(({ icon: Icon, ...item }) => <button className={currentPage === item.id ? "active" : ""} type="button" key={item.id} title={item.label} onClick={() => { setPage(item.id); setSidebarOpen(false); }}><Icon size={19} /><span>{item.label}</span></button>)}</nav>
        <div className="sidebar-user"><span className="admin-avatar">{session.username?.slice(0,1).toUpperCase()}</span><div><strong>{session.username}</strong><small>{isAdmin ? "系统管理员" : "教师"}</small></div><button className="icon-button dark" type="button" title="退出登录" onClick={handleLogout}><LogOut size={18} /></button></div>
      </aside>
      <div className="admin-main">
        <header className="topbar"><button className="icon-button top-menu" type="button" title="打开导航" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>{isAdmin ? "管理中心" : "教学工作台"}</span><strong>/</strong><span>{visibleNavigation.find((item) => item.id === currentPage)?.label}</span></div><div className="top-actions"><span className="environment"><i />开发环境</span><AdminNotificationBell isAdmin={isAdmin} onNavigate={setPage} /><span className="top-avatar">{session.username?.slice(0,1).toUpperCase()}</span></div></header>
        {renderPage()}
      </div>
      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setSidebarOpen(false)}><X /></button>}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}
