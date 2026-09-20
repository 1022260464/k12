import { useEffect, useMemo, useState } from "react";
import { Edit3, GraduationCap, KeyRound, Plus, RefreshCw, Search, ShieldOff, Trash2, UserRoundCheck, UsersRound } from "lucide-react";
import { usersApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";
import { UserForm } from "../components/UserForm.jsx";
import { PASSWORD_RULES_TEXT, passwordStrength, validateNewPassword } from "../utils/passwordValidation.js";

export function UserManagement({ roles, notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [editing, setEditing] = useState(undefined);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setLoadError("");
    try { setUsers(await usersApi.list()); }
    catch (error) { setLoadError(error.message); notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => users.filter((user) => {
    const keyword = query.trim().toLowerCase();
    const matchesKeyword = !keyword || [user.username, user.nickname, user.email].some((value) => value?.toLowerCase().includes(keyword));
    return matchesKeyword && (roleFilter === "ALL" || user.roleCode?.split(",").includes(roleFilter));
  }), [users, query, roleFilter]);

  async function saveUser(form) {
    if (editing) await usersApi.update(editing.id, form);
    else await usersApi.create(form);
    setEditing(undefined);
    notify(editing ? "用户资料已更新" : "用户已创建");
    await loadUsers();
  }

  async function openEdit(user) {
    setDetailLoadingId(user.id);
    try {
      setEditing(await usersApi.get(user.id));
    } catch (error) {
      notify(`用户详情加载失败：${error.message}`, "error");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function removeUser() {
    try {
      await usersApi.remove(deleting.id);
      setDeleting(null);
      notify("用户已删除");
      await loadUsers();
    } catch (error) { notify(error.message, "error"); }
  }

  async function toggleStatus(user) {
    const nextStatus = user.status === "ENABLED" ? "DISABLED" : "ENABLED";
    try { await usersApi.updateStatus(user.id, nextStatus); notify(nextStatus === "ENABLED" ? "账号已启用" : "账号已停用"); await loadUsers(); }
    catch (error) { notify(error.message, "error"); }
  }

  async function resetPassword(event) {
    event.preventDefault();
    const validationError = validateNewPassword(newPassword, { label: "新密码" });
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordError("");
    try {
      await usersApi.resetPassword(passwordTarget.id, newPassword);
      setPasswordTarget(null);
      setNewPassword("");
      notify("密码已重置，用户原有令牌将失效");
    } catch (error) {
      setPasswordError(error.message);
      notify(error.message, "error");
    }
  }

  return (
    <section className="page-section">
      <header className="page-heading"><div><p className="eyebrow">IDENTITY MANAGEMENT</p><h1>用户管理</h1><p>创建平台账号、维护用户资料并分配访问角色。</p></div><button className="button primary" type="button" onClick={() => setEditing(null)}><Plus size={18} />新建用户</button></header>
      <div className="metric-row"><article><span className="metric-icon green"><UsersRound /></span><div><strong>{users.length}</strong><small>平台用户</small></div></article><article><span className="metric-icon blue"><UserRoundCheck /></span><div><strong>{users.filter((user) => user.status === "ENABLED").length}</strong><small>正常账号</small></div></article><article><span className="metric-icon amber"><GraduationCap /></span><div><strong>{users.filter((user) => user.roleCode?.includes("ROLE_TEACHER")).length}</strong><small>教师账号</small></div></article></div>
      <div className="data-panel">
        <div className="table-toolbar"><label className="search-control"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户名、姓名或邮箱" /></label><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">全部角色</option>{roles.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select><button className="icon-button" type="button" title="刷新" onClick={loadUsers}><RefreshCw size={18} /></button></div>
        <div className="table-wrap"><table className="responsive-table"><thead><tr><th>用户</th><th>角色</th><th>状态</th><th>更新时间</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="empty-cell">正在加载用户...</td></tr> : loadError ? <tr><td colSpan="5" className="empty-cell table-error">加载失败：{loadError}。请点击刷新重试。</td></tr> : filtered.length === 0 ? <tr><td colSpan="5" className="empty-cell">没有匹配的用户</td></tr> : filtered.map((user) => <tr key={user.id}><td data-label="用户"><div className="identity-cell"><span className="table-avatar">{(user.nickname || user.username).slice(0,1)}</span><div><strong>{user.nickname || user.username}</strong><small>{user.username} · {user.email || "未填写邮箱"}</small></div></div></td><td data-label="角色"><div className="role-tags">{user.roleCode?.split(",").filter(Boolean).map((role) => <span key={role}>{roles.find((item) => item.code === role)?.name || role}</span>)}</div></td><td data-label="状态"><span className={`status ${user.status?.toLowerCase()}`}>{user.status === "ENABLED" ? "正常" : user.status === "LOCKED" ? "锁定" : "停用"}</span></td><td data-label="更新时间">{user.updatedTime ? new Date(user.updatedTime).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "-"}</td><td data-label="操作"><div className="row-actions"><button className="icon-button" type="button" title="编辑用户" disabled={detailLoadingId === user.id} onClick={() => openEdit(user)}><Edit3 size={17} /></button><button className="icon-button" type="button" title="重置密码" onClick={() => { setPasswordTarget(user); setNewPassword(""); setPasswordError(""); }}><KeyRound size={17} /></button><button className="icon-button" type="button" title={user.status === "ENABLED" ? "停用账号" : "启用账号"} onClick={() => toggleStatus(user)}><ShieldOff size={17} /></button><button className="icon-button danger" type="button" title="删除用户" onClick={() => setDeleting(user)}><Trash2 size={17} /></button></div></td></tr>)}</tbody></table></div>
      </div>
      {editing !== undefined && <Modal title={editing ? "编辑用户" : "新建用户"} description={editing ? "修改基础资料和账号角色。密码需通过独立流程重置。" : "创建后用户即可使用初始密码登录用户端。"} onClose={() => setEditing(undefined)}><UserForm user={editing} roles={roles} onCancel={() => setEditing(undefined)} onSubmit={saveUser} /></Modal>}
      {deleting && <Modal title="确认删除用户" description={`即将删除 ${deleting.nickname || deleting.username}，该操作会使账号无法继续登录。`} onClose={() => setDeleting(null)} width={460}><div className="confirm-actions"><button className="button ghost" type="button" onClick={() => setDeleting(null)}>取消</button><button className="button danger-solid" type="button" onClick={removeUser}>确认删除</button></div></Modal>}
      {passwordTarget && (
        <Modal
          title="重置用户密码"
          description={`为 ${passwordTarget.username} 设置新密码。${PASSWORD_RULES_TEXT}。`}
          onClose={() => setPasswordTarget(null)}
          width={460}
        >
          <form className="resource-form" onSubmit={resetPassword}>
            <label>新密码
              <input
                type="password"
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="至少8位，含字母和数字"
                required
              />
            </label>
            <ul className="password-checklist" aria-label="密码要求">
              <li className={passwordStrength(newPassword).lengthOk ? "ok" : ""}>8–72 位</li>
              <li className={passwordStrength(newPassword).hasLetter ? "ok" : ""}>含字母</li>
              <li className={passwordStrength(newPassword).hasDigit ? "ok" : ""}>含数字</li>
              <li className={passwordStrength(newPassword).noSpace ? "ok" : ""}>不含空格</li>
            </ul>
            {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
            <div>
              <button className="button ghost" type="button" onClick={() => setPasswordTarget(null)}>取消</button>
              <button className="button primary" type="submit">确认重置</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
