import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Info, LockKeyhole, Settings2, ShieldAlert } from "lucide-react";
import { rolesApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";

const ROLE_META = {
  ROLE_ADMIN: {
    title: "系统管理员",
    summary: "平台运维与账号治理",
    detail: "管理用户与角色、配置智能体、可介入全部课程与作业。权限全部锁定，不可打开控制面板修改。",
  },
  ROLE_TEACHER: {
    title: "教师",
    summary: "备课、发布与批改",
    detail: "课程/作业写操作与批改等由系统预置并锁定；控制面板仅可调整少量只读/调用类权限。",
  },
  ROLE_STUDENT: {
    title: "学生",
    summary: "选课学习与提交作业",
    detail: "账号治理类权限不会对学生开放。控制面板仅可调整少量学习相关安全权限。",
  },
};

/** 与后端 RolePermissionPolicy 对齐的可调白名单。 */
const SAFE_EDITABLE = {
  ROLE_TEACHER: ["course:read", "homework:read", "agent:read", "agent:invoke"],
  ROLE_STUDENT: [
    "course:read",
    "homework:read",
    "homework:submit",
    "agent:read",
    "agent:invoke",
    "learning-profile:read",
    "learning-profile:update",
  ],
};

const CONFIRM_PHRASE = "确认修改";

const PERMISSION_CATALOG = [
  {
    module: "用户与账号",
    hint: "高风险：仅管理员。界面锁定，不可授予教师/学生。",
    locked: true,
    items: [
      { code: "user:read", name: "查看用户", detail: "读取用户列表与详情。", recommended: ["ROLE_ADMIN"] },
      { code: "user:create", name: "创建用户", detail: "创建学生、教师或管理员账号。", recommended: ["ROLE_ADMIN"] },
      { code: "user:update", name: "修改用户", detail: "改资料、启停、重置密码、换角色。", recommended: ["ROLE_ADMIN"] },
      { code: "user:delete", name: "删除用户", detail: "删除账号及其角色绑定。", recommended: ["ROLE_ADMIN"] },
    ],
  },
  {
    module: "角色配置",
    hint: "高风险：仅管理员。改权限须经角色控制面板且受白名单约束。",
    locked: true,
    items: [
      { code: "role:read", name: "查看角色", detail: "读取系统角色及其权限清单。", recommended: ["ROLE_ADMIN"] },
      { code: "role:update", name: "修改角色权限", detail: "调用权限更新接口。", recommended: ["ROLE_ADMIN"] },
    ],
  },
  {
    module: "课程与教学资料",
    hint: "创建/修改/删除对教师预置并锁定；「查看课程」可在控制面板调整。",
    items: [
      { code: "course:read", name: "查看课程", detail: "读取课程、章节、小节与教学资料元数据。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_STUDENT"], safe: true },
      { code: "course:create", name: "创建课程", detail: "新建课程、导入结构、上传教学资料。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
      { code: "course:update", name: "修改课程", detail: "编辑课程信息、章节小节、发布与资料绑定。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
      { code: "course:delete", name: "删除课程", detail: "删除课程或相关教学资源。高风险，锁定。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
    ],
  },
  {
    module: "作业与测评",
    hint: "出题/批改/删除锁定；「查看」「提交」可在控制面板调整。",
    items: [
      { code: "homework:read", name: "查看作业", detail: "读取作业定义、提交与批改结果。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_STUDENT"], safe: true },
      { code: "homework:create", name: "创建作业", detail: "新建作业、题目与收件学生。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
      { code: "homework:update", name: "修改作业", detail: "编辑作业内容与发布状态。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
      { code: "homework:delete", name: "删除作业", detail: "删除作业任务。高风险，锁定。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
      { code: "homework:submit", name: "提交作业", detail: "学生提交或退回后重提。", recommended: ["ROLE_ADMIN", "ROLE_STUDENT"], safe: true },
      { code: "homework:grade", name: "批改作业", detail: "打分、评语、退回重做。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER"] },
    ],
  },
  {
    module: "智能体",
    hint: "创建/改删仅管理员且锁定；查看与调用可在控制面板调整。",
    items: [
      { code: "agent:read", name: "查看智能体", detail: "读取可用智能体列表与配置摘要。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_STUDENT"], safe: true },
      { code: "agent:create", name: "创建智能体", detail: "注册新的智能体配置。高风险，锁定。", recommended: ["ROLE_ADMIN"] },
      { code: "agent:update", name: "修改智能体", detail: "调整智能体参数或启用状态。高风险，锁定。", recommended: ["ROLE_ADMIN"] },
      { code: "agent:delete", name: "删除智能体", detail: "删除智能体配置。高风险，锁定。", recommended: ["ROLE_ADMIN"] },
      { code: "agent:invoke", name: "调用智能体", detail: "发起对话/任务调用。", recommended: ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_STUDENT"], safe: true },
    ],
  },
  {
    module: "学习档案",
    hint: "面向学生；可在学生控制面板调整。",
    items: [
      { code: "learning-profile:read", name: "查看学习档案", detail: "读取学习偏好、掌握度等。", recommended: ["ROLE_ADMIN", "ROLE_STUDENT"], safe: true },
      { code: "learning-profile:update", name: "修改学习档案", detail: "更新个人学习档案。", recommended: ["ROLE_ADMIN", "ROLE_STUDENT"], safe: true },
    ],
  },
];

const ROLE_ORDER = ["ROLE_ADMIN", "ROLE_TEACHER", "ROLE_STUDENT"];
const PERMISSION_META = Object.fromEntries(
  PERMISSION_CATALOG.flatMap((group) => group.items.map((item) => [item.code, item]))
);

function roleTitle(code, fallback) {
  return ROLE_META[code]?.title || fallback || code;
}

function roleHas(roles, roleCode, permissionCode) {
  const role = roles.find((item) => item.code === roleCode);
  return Boolean(role?.permissionCodes?.includes(permissionCode));
}

export function RoleManagement({ roles, setRoles, notify }) {
  const [panelRoleCode, setPanelRoleCode] = useState(null);

  const orderedRoles = useMemo(() => {
    const map = new Map(roles.map((role) => [role.code, role]));
    const known = ROLE_ORDER.map((code) => map.get(code)).filter(Boolean);
    const rest = roles.filter((role) => !ROLE_ORDER.includes(role.code));
    return [...known, ...rest];
  }, [roles]);

  function openPanel(roleCode) {
    if (roleCode === "ROLE_ADMIN") {
      notify("系统管理员权限全部锁定，不能打开控制面板", "error");
      return;
    }
    if (!SAFE_EDITABLE[roleCode]) {
      notify("该角色不支持在界面中调整权限", "error");
      return;
    }
    setPanelRoleCode(roleCode);
  }

  return (
    <section className="page-section role-guide">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ROLE & PERMISSION GUIDE</p>
          <h1>角色与权限说明</h1>
          <p>
            日常在「用户管理」分配角色即可。需要微调时，在上方角色卡片点击「权限控制面板」，
            仅能改该角色白名单内的安全权限；高风险权限始终锁定。
          </p>
        </div>
      </header>

      <div className="role-guide-banner">
        <ShieldAlert size={18} />
        <div>
          <strong>安全策略</strong>
          <p>
            用户/角色治理、智能体增删改、课程与作业写删批改等不可在此改动。
            控制面板只开放查看、调用、学生提交与学习档案等低风险项；服务端有同样白名单。
          </p>
        </div>
      </div>

      <div className="role-card-grid">
        {orderedRoles.map((role) => {
          const meta = ROLE_META[role.code] || { title: role.name, summary: role.description || role.code, detail: "" };
          const canOpenPanel = Boolean(SAFE_EDITABLE[role.code]);
          return (
            <article key={role.code} className="role-guide-card">
              <div className="role-guide-card-main">
                <span className="role-symbol">{meta.title.slice(0, 1)}</span>
                <div>
                  <strong>{meta.title}</strong>
                  <small>{role.code}</small>
                  <p>{meta.summary}</p>
                </div>
                <span className="permission-count">{role.permissionCodes?.length || 0}</span>
              </div>
              <p className="role-guide-detail">{meta.detail}</p>
              <div className="role-guide-card-actions">
                {canOpenPanel ? (
                  <button className="button primary compact" type="button" onClick={() => openPanel(role.code)}>
                    <Settings2 size={15} />
                    权限控制面板
                  </button>
                ) : (
                  <button className="button ghost compact" type="button" disabled>
                    <LockKeyhole size={15} />
                    权限已锁定
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="role-guide-panel">
        <header className="role-guide-panel-head">
          <BookOpen size={18} />
          <div>
            <h2>权限对照表</h2>
            <p>按模块列出权限含义与三角色归属。带锁为不可改；可调项请用上方「权限控制面板」。</p>
          </div>
        </header>
        <div className="perm-matrix-wrap">
          <table className="perm-matrix">
            <thead>
              <tr>
                <th>权限</th>
                <th>说明</th>
                {ROLE_ORDER.map((code) => (
                  <th key={code}>{roleTitle(code)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_CATALOG.map((group) => (
                <FragmentGroup key={group.module} group={group} roles={roles} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="role-guide-banner muted">
        <Info size={18} />
        <div>
          <strong>生效说明</strong>
          <p>权限写入 JWT，修改后该角色用户需重新登录。页面按钮只是门控；真正鉴权在 Gateway 与后端。</p>
        </div>
      </div>

      {panelRoleCode && (
        <RolePermissionPanel
          roleCode={panelRoleCode}
          roles={roles}
          setRoles={setRoles}
          notify={notify}
          onClose={() => setPanelRoleCode(null)}
        />
      )}
    </section>
  );
}

function FragmentGroup({ group, roles }) {
  return (
    <>
      <tr className="perm-matrix-group">
        <td colSpan={5}>
          <div className="perm-matrix-group-title">
            <strong>
              {group.module}
              {group.locked ? " · 全部锁定" : ""}
            </strong>
            {group.hint && <span>{group.hint}</span>}
          </div>
        </td>
      </tr>
      {group.items.map((item) => (
        <tr key={item.code}>
          <td>
            <strong>{item.name}</strong>
            <code>{item.code}</code>
            {item.safe ? (
              <span className="perm-safe-badge">可调整</span>
            ) : (
              <span className="perm-lock-badge">
                <LockKeyhole size={12} /> 锁定
              </span>
            )}
          </td>
          <td>{item.detail}</td>
          {ROLE_ORDER.map((roleCode) => {
            const owned = roleHas(roles, roleCode, item.code);
            const editable = SAFE_EDITABLE[roleCode]?.includes(item.code);
            return (
              <td key={roleCode} className={owned ? "yes" : "no"}>
                <span className={editable ? "perm-cell-safe" : "perm-cell-locked"} title={editable ? "可在控制面板调整" : "安全锁定"}>
                  {owned ? <Check size={15} /> : "—"}
                  {!editable && <LockKeyhole size={11} />}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function RolePermissionPanel({ roleCode, roles, setRoles, notify, onClose }) {
  const role = roles.find((item) => item.code === roleCode);
  const title = roleTitle(roleCode, role?.name);
  const safeCodes = SAFE_EDITABLE[roleCode] || [];
  const safeSet = useMemo(() => new Set(safeCodes), [safeCodes]);

  const lockedCodes = useMemo(() => {
    return (role?.permissionCodes || []).filter((code) => !safeSet.has(code)).sort();
  }, [role?.permissionCodes, safeSet]);

  const [draftSafe, setDraftSafe] = useState([]);
  const [roleCodeInput, setRoleCodeInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = new Set(role?.permissionCodes || []);
    setDraftSafe(safeCodes.filter((code) => current.has(code)));
    setRoleCodeInput("");
    setPhraseInput("");
    setAck(false);
  }, [role?.id, role?.permissionCodes, roleCode, safeCodes]);

  const initialSafe = useMemo(() => {
    const current = new Set(role?.permissionCodes || []);
    return safeCodes.filter((code) => current.has(code));
  }, [role?.permissionCodes, safeCodes]);

  const dirty =
    draftSafe.length !== initialSafe.length ||
    draftSafe.some((code) => !initialSafe.includes(code));

  const roleCodeOk = roleCodeInput.trim() === roleCode;
  const phraseOk = phraseInput.trim() === CONFIRM_PHRASE;
  const canSubmit = Boolean(role) && dirty && roleCodeOk && phraseOk && ack && !saving;

  function toggleSafe(code) {
    setDraftSafe((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit || !role) return;

    const next = [...lockedCodes, ...draftSafe.filter((code) => safeSet.has(code))];
    setSaving(true);
    try {
      const updated = await rolesApi.updatePermissions(role.id, next);
      setRoles((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      notify(`${title}可调权限已更新（需重新登录生效）`);
      onClose();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${title} · 权限控制面板`}
      description="仅显示可安全调整的权限；下方锁定权限只读，提交时不会被改动。"
      onClose={onClose}
      width={640}
      layer={160}
    >
      <form className="entity-form perm-edit-form" onSubmit={submit}>
        <div className="locked-note">
          <ShieldAlert size={18} />
          <span>
            将影响角色「{title}」（{roleCode}）下的全部用户。请只勾选确需开放的安全权限，并完成校验后再提交。
          </span>
        </div>

        <div className="perm-panel-section">
          <h3>可调整权限</h3>
          <p>取消勾选即撤销；勾选即授予。未列出的高风险权限不会出现在此。</p>
          <div className="perm-panel-grid">
            {safeCodes.map((code) => {
              const meta = PERMISSION_META[code] || { name: code, detail: "" };
              const checked = draftSafe.includes(code);
              return (
                <button
                  key={code}
                  className={`permission-item ${checked ? "checked" : ""}`}
                  type="button"
                  onClick={() => toggleSafe(code)}
                >
                  <span className="check-box">{checked && <Check size={16} />}</span>
                  <div>
                    <strong>{meta.name}</strong>
                    <small>{meta.detail}</small>
                    <code>{code}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="perm-panel-section locked-list">
          <h3>
            <LockKeyhole size={15} />
            已锁定权限（只读）
          </h3>
          <p>这些权限由系统预置，控制面板不能增删。</p>
          {lockedCodes.length === 0 ? (
            <p className="perm-edit-hint-muted">当前没有额外锁定权限项。</p>
          ) : (
            <ul className="perm-locked-chips">
              {lockedCodes.map((code) => (
                <li key={code}>
                  <LockKeyhole size={12} />
                  <span>{PERMISSION_META[code]?.name || code}</span>
                  <code>{code}</code>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label>
          输入角色代码以确认对象
          <input
            value={roleCodeInput}
            onChange={(event) => setRoleCodeInput(event.target.value)}
            placeholder={roleCode}
            autoComplete="off"
            spellCheck={false}
          />
          {!roleCodeOk && roleCodeInput && (
            <small className="field-error">须与 {roleCode} 完全一致</small>
          )}
        </label>

        <label>
          输入确认短语
          <input
            value={phraseInput}
            onChange={(event) => setPhraseInput(event.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            spellCheck={false}
          />
          {!phraseOk && phraseInput && (
            <small className="field-error">请输入「{CONFIRM_PHRASE}」</small>
          )}
        </label>

        <label className="perm-edit-ack">
          <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
          <span>我已知晓此变更会影响该角色全部用户，且需重新登录后生效；锁定权限不会被改动。</span>
        </label>

        {!dirty && <p className="perm-edit-hint">尚未修改可调权限，无需提交。</p>}

        <div className="form-actions">
          <button className="button ghost" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="submit" disabled={!canSubmit}>
            {saving ? "提交中..." : "保存该角色权限"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
