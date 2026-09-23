import { useEffect, useMemo, useState } from "react";
import { BookOpen, Settings2, ShieldCheck, Sparkles, Type } from "lucide-react";
import { knowledgeGraphApi } from "../../api/client.js";
import { AiSuggestButton, KnowledgePointPicker, KnowledgeSuggestionPreview } from "../KnowledgePointPicker.jsx";
import { Modal } from "../Modal.jsx";
import {
  STAGE_OPTIONS,
  defaultConfigForTemplate,
  emptyMissionForm,
  templateByCode,
} from "../../data/visualMissionTemplates.js";
import { TemplateConfigFields } from "./TemplateConfigFields.jsx";
import { MissionPreview } from "./MissionPreview.jsx";

const TABS = [
  { id: "basic", label: "基础信息", icon: Type },
  { id: "content", label: "教学内容", icon: BookOpen },
  { id: "config", label: "模板参数", icon: Settings2 },
  { id: "preview", label: "学生预览", icon: Sparkles },
];

export function MissionEditorModal({
  mission,
  templates = [],
  onClose,
  onSubmit,
  saving = false,
  notify,
}) {
  const editing = Boolean(mission?.id);
  const [form, setForm] = useState(() => (mission ? hydrate(mission) : emptyMissionForm()));
  const [error, setError] = useState("");
  const [tab, setTab] = useState("basic");
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [aiSuggestedCodes, setAiSuggestedCodes] = useState([]);
  const [suggestNote, setSuggestNote] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewSummary, setReviewSummary] = useState("");

  useEffect(() => {
    let cancelled = false;
    knowledgeGraphApi.points({ limit: 500 })
      .then((points) => {
        if (!cancelled) setKnowledgePoints(Array.isArray(points) ? points : []);
      })
      .catch(() => {
        if (!cancelled) setKnowledgePoints([]);
      });
    return () => { cancelled = true; };
  }, []);

  const templateOptions = useMemo(() => {
    if (templates?.length) return templates;
    return [
      { code: "DATA_LABELING", name: "数据标注训练" },
      { code: "PREDICTION_BRANCH", name: "预测与条件分支" },
      { code: "LOOP_ROUTE", name: "循环路线" },
      { code: "CONFIDENCE_GATE", name: "置信度门槛" },
      { code: "AGENT_PATROL", name: "智能体巡检" },
      { code: "DATA_BALANCE", name: "数据均衡与公平" },
      { code: "QUIZ_GAME", name: "AI 知识闯关" },
      { code: "SEQUENCE_STORY", name: "顺序故事绘本" },
    ];
  }, [templates]);

  const selectedPoint = useMemo(
    () => knowledgePoints.find((item) => item.code === form.knowledgeCode),
    [knowledgePoints, form.knowledgeCode],
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateStep(index, value) {
    setForm((current) => {
      const steps = [...(current.steps || [])];
      steps[index] = value;
      return { ...current, steps };
    });
  }

  function updateConcepts(text) {
    update("concepts", text.split(/[,，]/).map((item) => item.trim()).filter(Boolean));
  }

  function toast(message, tone = "info") {
    if (typeof notify === "function") notify(message, tone);
    else if (tone === "error") setError(message);
  }

  async function suggestKnowledge() {
    if (!String(form.description || "").trim() && !String(form.title || "").trim()) {
      toast("请先填写标题或简介，再让 AI 建议知识点", "error");
      setTab("basic");
      return;
    }
    setSuggesting(true);
    try {
      let codes = [];
      try {
        const result = await Promise.race([
          knowledgeGraphApi.suggestCovers({
            title: form.title,
            content: [form.description, form.story, form.goal].filter(Boolean).join("\n"),
            limit: 5,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);
        codes = (result?.suggestions || []).map((item) => item.code).filter(Boolean);
      } catch {
        // local fallback below
      }
      if (!codes.length) {
        codes = localSuggestKnowledge(
          form.title,
          `${form.description || ""} ${form.story || ""} ${form.goal || ""}`,
          knowledgePoints,
          8,
        );
      }
      if (!codes.length) {
        toast("暂无匹配建议，请在下方手工勾选主知识点", "error");
        return;
      }
      const catalogCodes = new Set(knowledgePoints.map((point) => point.code));
      const previewCodes = [...new Set(codes)].filter((code) => catalogCodes.has(code));
      if (!previewCodes.length) {
        toast("建议结果不在当前知识点目录中，请刷新目录后重试", "error");
        setAiSuggestedCodes([]);
        setSuggestNote("");
        return;
      }
      setAiSuggestedCodes(previewCodes);
      setSuggestNote(`AI 建议 ${previewCodes.length} 个，仅供预览；采纳后才会设置为主知识点`);
      setReviewItems([]);
      setReviewSummary("");
      toast("知识点建议已生成，请在预览区核对后采纳");
    } catch (cause) {
      toast(cause.message || "AI 建议失败", "error");
    } finally {
      setSuggesting(false);
    }
  }

  function acceptKnowledgeSuggestion(code) {
    update("knowledgeCode", code);
    setReviewItems([]);
    setReviewSummary("");
  }

  function closeKnowledgeSuggestions() {
    setAiSuggestedCodes([]);
    setSuggestNote("");
  }

  async function reviewKnowledge() {
    const code = String(form.knowledgeCode || "").trim();
    if (!code) {
      toast("请先选择主知识点再审查", "error");
      return;
    }
    if (!String(form.description || "").trim() && !String(form.title || "").trim()) {
      toast("请先填写标题或简介作为审查依据", "error");
      return;
    }
    setReviewing(true);
    try {
      const result = await knowledgeGraphApi.reviewAlignment({
        title: form.title,
        content: [form.description, form.story, form.goal].filter(Boolean).join("\n"),
        stage: mapStageForReview(form.stageCode),
        knowledgeCodes: [code],
      });
      setReviewItems(result.items || []);
      setReviewSummary(result.summary || "");
      toast(result.summary || "审查完成");
    } catch (cause) {
      toast(cause.message || "审查失败", "error");
    } finally {
      setReviewing(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.shortTitle.trim() || !form.missionCode.trim()) {
      setError("请填写关卡编码、标题和短标题");
      setTab("basic");
      return;
    }
    if (!String(form.knowledgeCode || "").trim()) {
      setError("请从官方知识点目录中选择主知识点（可点 AI 建议）");
      setTab("basic");
      return;
    }
    if ((form.steps || []).filter((item) => String(item || "").trim()).length !== 3) {
      setError("学习步骤必须正好 3 项");
      setTab("content");
      return;
    }
    setError("");
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        shortTitle: form.shortTitle.trim(),
        missionCode: form.missionCode.trim(),
        knowledgeCode: form.knowledgeCode.trim(),
        description: form.description.trim(),
        story: form.story.trim(),
        goal: form.goal.trim(),
        hint: form.hint.trim(),
        badge: form.badge.trim(),
        reflection: form.reflection.trim(),
        steps: form.steps.map((item) => String(item).trim()),
        concepts: form.concepts,
        config: normalizeConfig(form.templateCode, form.config),
      });
    } catch (submitError) {
      setError(submitError.message || "保存失败");
    }
  }

  const previewMission = { ...form, status: mission?.status || "DRAFT" };

  return (
    <Modal
      title={editing ? "编辑图形化关卡" : "新建图形化关卡"}
      description="教学内容可配置；执行逻辑只能选择白名单任务模板。主知识点与课程/资料共用官方目录。"
      onClose={onClose}
      width={1120}
      className="vp-editor-modal"
    >
      <form className="entity-form vp-editor" onSubmit={handleSubmit}>
        <nav className="vp-editor-tabs" role="tablist" aria-label="编辑分区">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        <div className="vp-editor-shell">
          <div className="vp-editor-main">
            {tab === "basic" && (
              <section className="vp-editor-section">
                <header>
                  <strong>基础信息</strong>
                  <p>编码创建后不可改；有学生进度后也不能更换任务模板。</p>
                </header>
                <div className="form-grid vp-form-grid">
                  <label>关卡编码
                    <input
                      value={form.missionCode}
                      disabled={editing}
                      maxLength={64}
                      placeholder="例如：pet-confidence-check"
                      onChange={(event) => update("missionCode", event.target.value)}
                      required
                    />
                  </label>
                  <label>任务模板
                    <select
                      value={form.templateCode}
                      disabled={editing && (mission?.studentProgressCount > 0 || mission?.studentCount > 0)}
                      onChange={(event) => {
                        const code = event.target.value;
                        setForm((current) => ({
                          ...current,
                          templateCode: code,
                          config: defaultConfigForTemplate(code),
                        }));
                      }}
                    >
                      {templateOptions.map((item) => {
                        const code = item.code || item.templateCode;
                        return (
                          <option key={code} value={code}>
                            {item.name || templateByCode(code).name}（{code}）
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="wide">完整标题
                    <input value={form.title} maxLength={80} onChange={(event) => update("title", event.target.value)} required />
                  </label>
                  <label>短标题
                    <input value={form.shortTitle} maxLength={40} onChange={(event) => update("shortTitle", event.target.value)} required />
                  </label>
                  <label>学段
                    <select value={form.stageCode} onChange={(event) => update("stageCode", event.target.value)}>
                      {STAGE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>排序
                    <input type="number" min={0} value={form.sortOrder} onChange={(event) => update("sortOrder", Number(event.target.value))} />
                  </label>
                  <label className="wide">简介
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={form.description}
                      onChange={(event) => update("description", event.target.value)}
                      placeholder="简介会作为 AI 建议与审查依据"
                      required
                    />
                  </label>
                </div>

                <section className="form-section knowledge-cover-panel vp-knowledge-panel">
                  <header className="knowledge-cover-header">
                    <div>
                      <strong>主知识点</strong>
                      <small>
                        与课程章节、教学资料同一套官方目录；AI 建议单独预览，采纳后再保存。
                        {selectedPoint ? ` 当前：${selectedPoint.title || selectedPoint.code}` : form.knowledgeCode ? ` 当前编码：${form.knowledgeCode}` : ""}
                      </small>
                    </div>
                    <div className="knowledge-cover-actions">
                      <AiSuggestButton suggesting={suggesting} onClick={suggestKnowledge} />
                      <button
                        className="button ghost compact"
                        type="button"
                        disabled={reviewing || !form.knowledgeCode}
                        onClick={reviewKnowledge}
                      >
                        <ShieldCheck size={14} />{reviewing ? "审查中…" : "审查"}
                      </button>
                    </div>
                  </header>
                  {suggestNote && <p className="binding-hint">{suggestNote}</p>}
                  <KnowledgeSuggestionPreview
                    points={knowledgePoints}
                    suggestedCodes={aiSuggestedCodes}
                    selectedCodes={form.knowledgeCode ? [form.knowledgeCode] : []}
                    mode="single"
                    onAccept={acceptKnowledgeSuggestion}
                    onClose={closeKnowledgeSuggestions}
                  />
                  <KnowledgePointPicker
                    mode="single"
                    points={knowledgePoints}
                    selectedCodes={form.knowledgeCode ? [form.knowledgeCode] : []}
                    aiSuggestedCodes={aiSuggestedCodes}
                    onChange={(codes) => {
                      update("knowledgeCode", codes[0] || "");
                      setReviewItems([]);
                      setReviewSummary("");
                    }}
                    emptyText="暂无知识点目录，请先在知识图谱同步后再试"
                  />
                  {reviewItems.length > 0 && (
                    <div className="kg-review-panel">
                      {reviewSummary ? <p className="kg-review-summary">{reviewSummary}</p> : null}
                      <ul className="kg-review-list">
                        {reviewItems.map((item) => (
                          <li key={item.code} className={`is-${String(item.verdict || "").toLowerCase()}`}>
                            <div className="kg-review-row">
                              <strong>{item.title || item.code}</strong>
                              <span>{item.verdict === "KEEP" ? "匹配" : item.verdict === "REVIEW" ? "待核" : "不符"}</span>
                            </div>
                            {item.reason ? <p>{item.reason}</p> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </section>
            )}

            {tab === "content" && (
              <section className="vp-editor-section">
                <header>
                  <strong>教学内容</strong>
                  <p>故事、目标、步骤和徽章会直接出现在学生端关卡页。</p>
                </header>
                <div className="form-grid vp-form-grid">
                  <label className="wide">故事
                    <textarea rows={3} maxLength={600} value={form.story} onChange={(event) => update("story", event.target.value)} required />
                  </label>
                  <label className="wide">过关目标
                    <textarea rows={2} maxLength={400} value={form.goal} onChange={(event) => update("goal", event.target.value)} required />
                  </label>
                  <label className="wide">提示
                    <textarea rows={2} maxLength={600} value={form.hint} onChange={(event) => update("hint", event.target.value)} required />
                  </label>
                  <label>徽章名
                    <input value={form.badge} maxLength={40} onChange={(event) => update("badge", event.target.value)} required />
                  </label>
                  <label>概念标签（逗号分隔）
                    <input
                      value={(form.concepts || []).join("，")}
                      onChange={(event) => updateConcepts(event.target.value)}
                      placeholder="置信度，阈值"
                    />
                  </label>
                  <label className="wide">反思
                    <textarea rows={2} maxLength={500} value={form.reflection} onChange={(event) => update("reflection", event.target.value)} required />
                  </label>
                  {[0, 1, 2].map((index) => (
                    <label key={index} className="wide">步骤 {index + 1}
                      <input
                        value={form.steps?.[index] || ""}
                        maxLength={40}
                        onChange={(event) => updateStep(index, event.target.value)}
                        required
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}

            {tab === "config" && (
              <section className="vp-editor-section">
                <header>
                  <strong>模板参数</strong>
                  <p>只影响后续提交的服务端评分，不会重算学生历史最好成绩。</p>
                </header>
                <TemplateConfigFields
                  templateCode={form.templateCode}
                  config={form.config}
                  onChange={(config) => update("config", config)}
                />
              </section>
            )}

            {tab === "preview" && (
              <section className="vp-editor-section">
                <header>
                  <strong>学生端预览</strong>
                  <p>以下为关卡卡片示意，发布后才会出现在学生端列表。</p>
                </header>
                <MissionPreview mission={previewMission} />
              </section>
            )}
          </div>

          <aside className="vp-editor-side" aria-label="实时预览">
            <div className="vp-editor-side-head">
              <Sparkles size={16} />
              <div>
                <strong>实时预览</strong>
                <p>随左侧表单同步更新</p>
              </div>
            </div>
            <MissionPreview mission={previewMission} />
          </aside>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="form-actions vp-editor-actions">
          <button className="button ghost" type="button" onClick={onClose}>取消</button>
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "保存中…" : editing ? "保存修改" : "创建草稿"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function hydrate(mission) {
  return {
    ...emptyMissionForm(mission.templateCode),
    ...mission,
    steps: Array.isArray(mission.steps) && mission.steps.length === 3
      ? mission.steps
      : ["第一步", "第二步", "第三步"],
    concepts: Array.isArray(mission.concepts) ? mission.concepts : [],
    config: mission.config || mission.runtimeConfig || defaultConfigForTemplate(mission.templateCode),
  };
}

function normalizeConfig(templateCode, config) {
  const next = { ...(config || {}) };
  if (typeof next.requiredClasses === "string") {
    next.requiredClasses = next.requiredClasses.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  }
  return next;
}

function mapStageForReview(stageCode) {
  switch (stageCode) {
    case "LOWER_PRIMARY":
      return "LOW_PRIMARY";
    case "UPPER_PRIMARY":
      return "HIGH_PRIMARY";
    default:
      return stageCode || undefined;
  }
}

function localSuggestKnowledge(title, description, points, limit = 5) {
  const hay = `${title || ""} ${description || ""}`.toLowerCase();
  if (!hay.trim() || !points?.length) return [];
  const scored = [];
  for (const point of points) {
    let score = 0;
    const pointTitle = String(point.title || "").toLowerCase();
    const code = String(point.code || "").toLowerCase();
    if (pointTitle && hay.includes(pointTitle)) score += 10;
    for (const token of pointTitle.split(/[\s/、，,；;：:()（）\[\]|-]+/).filter((t) => t.length >= 2)) {
      if (hay.includes(token)) { score += 3; break; }
    }
    if (/python|程序|代码|编程|循环|算法|积木/.test(hay) && /computing\.|algorithm|loop|programming/.test(code)) score += 5;
    if (/数据|标注|标签|隐私/.test(hay) && /data_literacy|data\.|label/.test(code)) score += 4;
    if (/机器学习|监督|分类|特征|训练|置信|预测/.test(hay) && /machine_learning|ml\.|confidence|classif/.test(code)) score += 5;
    if (/ai|智能|模型|智能体|代理|巡检/.test(hay) && /generative_ai|machine_learning|agent/.test(code)) score += 4;
    if (score > 0) scored.push({ code: point.code, score });
  }
  scored.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  return scored.slice(0, limit).map((item) => item.code);
}
