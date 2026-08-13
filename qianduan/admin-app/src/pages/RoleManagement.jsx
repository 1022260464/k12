import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { rolesApi } from "../api/client.js";

const permissionLabels = {
  "user:read": ["查看用户", "读取用户列表和详情"],
  "user:create": ["创建用户", "创建学生、教师和管理员账号"],
  "user:update": ["修改用户", "修改用户资料、状态和所属角色"],
  "user:delete": ["删除用户", "删除用户账号和角色关系"],
  "role:read": ["查看角色", "读取角色及其权限配置"],
  "role:update": ["配置角色", "修改非管理员角色的权限"],
  "course:read": ["查看课程", "读取课程和教学资源"],
  "course:create": ["创建课程", "新增课程和教学内容"],
  "course:update": ["修改课程", "修改课程和教学内容"],
  "course:delete": ["删除课程", "删除课程及相关内容"],
  "agent:read": ["查看智能体", "读取智能体配置"],
  "agent:create": ["创建智能体", "新增智能体配置"],
  "agent:update": ["修改智能体", "修改智能体配置"],
  "agent:delete": ["删除智能体", "删除智能体配置"],
  "homework:read": ["查看作业", "读取作业和提交信息"],
  "homework:create": ["创建作业", "新增作业任务"],
  "homework:update": ["修改作业", "修改作业任务"],
  "homework:delete": ["删除作业", "删除作业任务"],
};

export function RoleManagement({ roles, setRoles, notify }) {
  const [selectedCode, setSelectedCode] = useState("ROLE_ADMIN");
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const selected = roles.find((role) => role.code === selectedCode) || roles[0];
  const allPermissions = useMemo(() => Array.from(new Set(roles.flatMap((role) => role.permissionCodes || []))), [roles]);

  useEffect(() => { setDraft(selected?.permissionCodes || []); }, [selectedCode, selected?.id]);

  function toggle(code) {
    if (selected?.code === "ROLE_ADMIN") return;
    setDraft((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await rolesApi.updatePermissions(selected.id, draft);
      setRoles((current) => current.map((role) => role.id === updated.id ? updated : role));
      notify("角色权限已更新");
    } catch (error) { notify(error.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <section className="page-section">
      <header className="page-heading"><div><p className="eyebrow">ROLE-BASED ACCESS CONTROL</p><h1>角色与权限</h1><p>角色决定用户能访问哪些业务资源，权限变更会在下次登录签发令牌时生效。</p></div></header>
      <div className="permission-layout">
        <aside className="role-list"><header><ShieldCheck size={19} /><strong>系统角色</strong></header>{roles.map((role) => <button className={selectedCode === role.code ? "active" : ""} type="button" key={role.code} onClick={() => setSelectedCode(role.code)}><span className="role-symbol">{role.name.slice(0,1)}</span><div><strong>{role.name}</strong><small>{role.code}</small></div><span className="permission-count">{role.permissionCodes?.length || 0}</span></button>)}</aside>
        <div className="permission-panel"><header className="permission-heading"><div><span className="role-symbol large">{selected?.name?.slice(0,1)}</span><div><h2>{selected?.name}</h2><p>{selected?.description || "配置该角色可访问的系统能力。"}</p></div></div><button className="button primary" type="button" disabled={saving || selected?.code === "ROLE_ADMIN"} onClick={save}><Save size={17} />{saving ? "保存中..." : "保存权限"}</button></header>{selected?.code === "ROLE_ADMIN" && <div className="locked-note"><LockKeyhole size={18} /><span>系统管理员默认拥有全部权限，为避免管理端失去控制，此角色不允许在界面中移除权限。</span></div>}<div className="permission-grid">{allPermissions.map((code) => { const [name, description] = permissionLabels[code] || [code, "业务接口访问权限"]; const checked = draft.includes(code); return <button className={`permission-item ${checked ? "checked" : ""}`} type="button" key={code} onClick={() => toggle(code)}><span className="check-box">{checked && <Check size={16} />}</span><div><strong>{name}</strong><small>{description}</small><code>{code}</code></div></button>; })}</div><div className="permission-footnote"><KeyRound size={17} /><span>页面按钮控制只改善交互体验，真正的权限判断仍由 Gateway 和后端服务完成。</span></div></div>
      </div>
    </section>
  );
}
