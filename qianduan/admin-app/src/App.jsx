import { useEffect, useState } from "react";
import { Bell, BookOpen, LayoutDashboard, LogOut, Menu, PanelLeftClose, Settings, ShieldCheck, Users, X } from "lucide-react";
import { clearSession, getSession, rolesApi } from "./api/client.js";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RoleManagement } from "./pages/RoleManagement.jsx";
import { UserManagement } from "./pages/UserManagement.jsx";

const navigation = [
  { id: "overview", label: "工作台", icon: LayoutDashboard, disabled: true },
  { id: "users", label: "用户管理", icon: Users },
  { id: "roles", label: "角色与权限", icon: ShieldCheck },
  { id: "courses", label: "课程资源", icon: BookOpen, disabled: true },
  { id: "settings", label: "系统设置", icon: Settings, disabled: true },
];

export function App() {
  const [session, setSession] = useState(getSession);
  const [page, setPage] = useState("users");
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

  if (!session) return <LoginPage onLogin={setSession} />;

  return (
    <main className="admin-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><a className="brand" href="/"><span className="brand-mark">eg</span><span>平台管理中心</span></a><button className="icon-button sidebar-close" type="button" title="关闭导航" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={19} /></button></div>
        <nav className="side-nav" aria-label="管理端导航">{navigation.map(({ icon: Icon, ...item }) => <button className={page === item.id ? "active" : ""} type="button" key={item.id} disabled={item.disabled} title={item.disabled ? "功能后续开放" : item.label} onClick={() => { setPage(item.id); setSidebarOpen(false); }}><Icon size={19} /><span>{item.label}</span>{item.disabled && <small>待开放</small>}</button>)}</nav>
        <div className="sidebar-user"><span className="admin-avatar">{session.username?.slice(0,1).toUpperCase()}</span><div><strong>{session.username}</strong><small>系统管理员</small></div><button className="icon-button dark" type="button" title="退出登录" onClick={handleLogout}><LogOut size={18} /></button></div>
      </aside>
      <div className="admin-main">
        <header className="topbar"><button className="icon-button top-menu" type="button" title="打开导航" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>管理中心</span><strong>/</strong><span>{navigation.find((item) => item.id === page)?.label}</span></div><div className="top-actions"><span className="environment"><i />开发环境</span><button className="icon-button" type="button" title="通知"><Bell size={18} /></button><span className="top-avatar">{session.username?.slice(0,1).toUpperCase()}</span></div></header>
        {page === "roles" ? <RoleManagement roles={roles} setRoles={setRoles} notify={notify} /> : <UserManagement roles={roles} notify={notify} />}
      </div>
      {sidebarOpen && <button className="sidebar-scrim" type="button" aria-label="关闭导航" onClick={() => setSidebarOpen(false)}><X /></button>}
      {toast && <div className={`toast ${toast.type}`} role="status">{toast.message}</div>}
    </main>
  );
}
