import {
  Blocks,
  Copy,
  Edit3,
  LoaderCircle,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { visualMissionsApi } from "../api/client.js";
import { MissionEditorModal } from "../components/visual-programming/MissionEditorModal.jsx";
import {
  STATUS_META,
  STAGE_OPTIONS,
  VISUAL_MISSION_TEMPLATES,
  templateByCode,
} from "../data/visualMissionTemplates.js";

export function VisualProgrammingMissionManagement({ notify }) {
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState(VISUAL_MISSION_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState("ALL");
  const [templateCode, setTemplateCode] = useState("ALL");
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [list, templateList] = await Promise.all([
        visualMissionsApi.list({
          status: status === "ALL" ? undefined : status,
          templateCode: templateCode === "ALL" ? undefined : templateCode,
          keyword: queryText.trim() || undefined,
        }),
        visualMissionsApi.templates().catch(() => VISUAL_MISSION_TEMPLATES),
      ]);
      setItems(Array.isArray(list) ? list : (list?.items || []));
      if (Array.isArray(templateList) && templateList.length) {
        setTemplates(templateList.map((item) => {
          const code = item.templateCode || item.code;
          const local = templateByCode(code);
          return {
            ...local,
            ...item,
            code,
            name: item.name || local.name,
            summary: item.summary || local.summary,
          };
        }));
      }
    } catch (requestError) {
      setError(requestError.message || "关卡列表加载失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, templateCode]);

  const stats = useMemo(() => ({
    total: items.length,
    draft: items.filter((item) => item.status === "DRAFT").length,
    published: items.filter((item) => item.status === "PUBLISHED").length,
    offline: items.filter((item) => item.status === "OFFLINE").length,
  }), [items]);

  const filtered = useMemo(() => {
    const keyword = queryText.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => [
      item.title, item.shortTitle, item.missionCode, item.knowledgeCode,
    ].some((value) => String(value || "").toLowerCase().includes(keyword)));
  }, [items, queryText]);

  async function saveMission(payload) {
    setSaving(true);
    try {
      if (editor?.id) {
        await visualMissionsApi.update(editor.id, payload);
        notify?.("关卡已更新");
      } else {
        await visualMissionsApi.create(payload);
        notify?.("草稿已创建");
      }
      setEditor(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action, item) {
    try {
      if (action === "publish") {
        await visualMissionsApi.publish(item.id);
        notify?.("已发布到学生端");
      } else if (action === "offline") {
        await visualMissionsApi.offline(item.id);
        notify?.("已下架");
      } else if (action === "duplicate") {
        await visualMissionsApi.duplicate(item.id, {
          missionCode: `${item.missionCode}-copy-${Date.now().toString().slice(-4)}`,
          title: `${item.title}（副本）`,
        });
        notify?.("已复制为草稿");
      } else if (action === "remove") {
        if (!window.confirm(`确认删除草稿「${item.title}」？仅无学习记录的草稿可删。`)) return;
        await visualMissionsApi.remove(item.id);
        notify?.("草稿已删除");
      }
      await load();
    } catch (actionError) {
      notify?.(actionError.message || "操作失败", "error");
    }
  }

  return (
    <div className="page-stack vp-admin-page">
      <section className="vp-admin-hero">
        <div>
          <p className="eyebrow"><Blocks size={15} /> 图形化 AI 编程</p>
          <h1>关卡管理</h1>
          <p>配置 Blockly 关卡的故事、目标和模板参数。执行逻辑只能选择白名单模板，不能编写脚本。</p>
          <div className="vp-admin-stats">
            <article><small>全部</small><strong>{stats.total}</strong></article>
            <article><small>已发布</small><strong>{stats.published}</strong></article>
            <article><small>草稿</small><strong>{stats.draft}</strong></article>
            <article><small>已下架</small><strong>{stats.offline}</strong></article>
          </div>
        </div>
        <button className="button primary" type="button" onClick={() => setEditor({})}>
          <Plus size={16} /> 新建关卡
        </button>
      </section>

      <section className="vp-admin-panel">
        <div className="table-toolbar vp-admin-toolbar">
          <label className="search-control">
            <Search size={18} />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="搜索标题、编码或知识点"
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="OFFLINE">已下架</option>
          </select>
          <select value={templateCode} onChange={(event) => setTemplateCode(event.target.value)}>
            <option value="ALL">全部模板</option>
            {VISUAL_MISSION_TEMPLATES.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>
          <button className="icon-button" type="button" title="刷新" onClick={load}><RefreshCw size={18} /></button>
        </div>

        {loading ? (
          <div className="vp-admin-empty"><LoaderCircle className="spin" size={22} />正在加载关卡…</div>
        ) : error ? (
          <div className="vp-admin-empty error">
            <p>{error}</p>
            <p className="muted">请确认已执行关卡表升级 SQL，且 Learning 服务已启动管理端接口。</p>
            <button className="button" type="button" onClick={load}>重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="vp-admin-empty">
            <Blocks size={28} />
            <strong>还没有关卡</strong>
            <p>先创建草稿，配置模板参数后再发布到学生端「AI 积木实验室」。</p>
            <button className="button primary" type="button" onClick={() => setEditor({})}>新建第一关</button>
          </div>
        ) : (
          <div className="vp-mission-grid">
            {filtered.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.DRAFT;
              const template = templateByCode(item.templateCode);
              const stageLabel = STAGE_OPTIONS.find((option) => option.value === item.stageCode)?.label || item.stageCode;
              return (
                <article className={`vp-mission-card tone-${meta.tone}`} key={item.id}>
                  <header>
                    <span className={`vp-status-chip ${meta.tone}`}>{meta.label}</span>
                    <small>v{item.contentVersion || 1}</small>
                  </header>
                  <div className="vp-mission-card-body">
                    <p className="eyebrow">#{item.sortOrder ?? 0} · {item.shortTitle}</p>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="vp-mission-meta">
                      <span>{template.name}</span>
                      <span>{stageLabel}</span>
                      <span>{item.knowledgeCode}</span>
                      <span>学生 {item.studentProgressCount ?? item.studentCount ?? 0}</span>
                    </div>
                  </div>
                  <footer>
                    <button type="button" onClick={() => setEditor(item)}><Edit3 size={14} />编辑</button>
                    <button type="button" onClick={() => runAction("duplicate", item)}><Copy size={14} />复制</button>
                    {item.status === "PUBLISHED" ? (
                      <button type="button" onClick={() => runAction("offline", item)}><Power size={14} />下架</button>
                    ) : (
                      <button type="button" onClick={() => runAction("publish", item)}><UploadCloud size={14} />发布</button>
                    )}
                    {item.status === "DRAFT" && (
                      <button type="button" className="danger" onClick={() => runAction("remove", item)}>
                        <Trash2 size={14} />删除
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editor && (
        <MissionEditorModal
          mission={editor.id ? editor : null}
          templates={templates}
          saving={saving}
          notify={notify}
          onClose={() => setEditor(null)}
          onSubmit={saveMission}
        />
      )}
    </div>
  );
}
