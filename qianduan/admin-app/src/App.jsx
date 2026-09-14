import { useEffect, useState } from "react";
import { Bell, Bot, BookOpen, ClipboardCheck, LayoutDashboard, LogOut, Menu, PanelLeftClose, ScrollText, Settings, ShieldCheck, Users, X } from "lucide-react";
import { clearSession, getSession, rolesApi } from "./api/client.js";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RoleManagement } from "./pages/RoleManagement.jsx";
import { UserManagement } from "./pages/UserManagement.jsx";
import { AuditManagement } from "./pages/AuditManagement.jsx";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { PlaceholderPage } from "./pages/PlaceholderPage.jsx";
import { ResourceManagement } from "./pages/ResourceManagement.jsx";

const navigation = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "users", label: "用户管理", icon: Users },
  { id: "roles", label: "角色与权限", icon: ShieldCheck },
  { id: "courses", label: "课程资源", icon: BookOpen },
  { id: "agents", label: "智能体管理", icon: Bot },
  { id: "homeworks", label: "作业管理", icon: ClipboardCheck },
  { id: "audits", label: "安全审计", icon: ScrollText },
  { id: "settings", label: "系统设置", icon: Settings },
];

export function App() {
  const [session, setSession] = useState(getSession);
  const [page, setPage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roles, setRoles] = useState([]);
  const [toast, setToast] = useState(null);

  function notify(message, type = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    if (!session) return;
    rolesApi.list().then(setRoles).catch((error) => {
      if (error.status === 401) {
        setSession(null);
        return;
      }
      notify(error.message, "error");
    });
  }, [session]);

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  function renderPage() {
    if (page === "overview") return <OverviewPage notify={notify} />;
    if (page === "users") return <UserManagement roles={roles} notify={notify} />;
    if (page === "roles") return <RoleManagement roles={roles} setRoles={setRoles} notify={notify} />;
    if (["courses", "agents", "homeworks"].includes(page)) return <ResourceManagement resource={page} notify={notify} />;
    if (page === "audits") return <AuditManagement notify={notify} />;
    return <PlaceholderPage title="系统设置" description="通知策略、全局参数和配置中心管理尚无对应后端接口。" />;
  }

  if (!session) return <LoginPage onLogin={setSession} />;

  return (
    <main className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><a className="brand" href="/"><span className="brand-mark">eg</span><span>平台管理中心</span></a><button className="icon-button sidebar-close" type="button" title="关闭导航" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={19} /></button></div>
        <nav className="side-nav" aria-label="管理端导航">{navigation.map(({ icon: Icon, ...item }) => <button className={page === item.id ? "active" : ""} type="button" key={item.id} disabled={item.disabled} title={item.disabled ? "功能后续开放" : item.label} onClick={() => { setPage(item.id); setSidebarOpen(false); }}><Icon size={19} /><span>{item.label}</span>{item.disabled && <small>待开放</small>}</button>)}</nav>
        <div className="sidebar-user"><span className="admin-avatar">{session.username?.slice(0,1).toUpperCase()}</span><div><strong>{session.username}</strong><small>系统管理员</small></div><button className="icon-button dark" type="button" title="退出登录" onClick={handleLogout}><LogOut size={18} /></button></div>
      </aside>
      <div className="admin-main">
        <header className="topbar"><button className="icon-button top-menu" type="button" title="打开导航" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>管理中心</span><strong>/</strong><span>{navigation.find((item) => item.id === page)?.label}</span></div><div className="top-actions"><span className="environment"><i />开发环境</span><button className="icon-button" type="button" title="通知功能待开发" disabled><Bell size={18} /></button><span className="top-avatar">{session.username?.slice(0,1).toUpperCase()}</span></div></header>
        {renderPage()}
      </div>
      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setSidebarOpen(false)}><X /></button>}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}
