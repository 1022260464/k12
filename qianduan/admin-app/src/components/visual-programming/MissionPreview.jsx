import { Award, BookOpenCheck, Lightbulb, ListChecks, Sparkles } from "lucide-react";
import { STATUS_META, templateByCode } from "../../data/visualMissionTemplates.js";

export function MissionPreview({ mission }) {
  if (!mission) {
    return (
      <div className="vp-preview empty">
        <Sparkles size={22} />
        <p>填写左侧内容后，这里会显示学生端卡片预览。</p>
      </div>
    );
  }
  const status = STATUS_META[mission.status] || STATUS_META.DRAFT;
  const template = templateByCode(mission.templateCode);

  return (
    <article className="vp-preview-card">
      <header>
        <span className={`vp-status-chip ${status.tone}`}>{status.label || "预览"}</span>
        <small>{template.name}</small>
      </header>
      <div className="vp-preview-hero">
        <span className="vp-preview-orb" aria-hidden="true" />
        <div>
          <p className="eyebrow">第 {mission.sortOrder || "?"} 关 · {mission.shortTitle || "短标题"}</p>
          <h3>{mission.title || "关卡标题"}</h3>
          <p>{mission.description || "关卡简介会显示在这里。"}</p>
        </div>
      </div>
      <div className="vp-preview-story">
        <BookOpenCheck size={16} />
        <p>{mission.story || "故事背景…"}</p>
      </div>
      <div className="vp-preview-goal">
        <strong>过关目标</strong>
        <p>{mission.goal || "目标说明…"}</p>
        <div className="vp-preview-tags">
          {(mission.concepts || []).filter(Boolean).map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <div className="vp-preview-steps">
        <ListChecks size={16} />
        <ol>
          {(mission.steps || []).filter(Boolean).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </div>
      <div className="vp-preview-hint">
        <Lightbulb size={15} />
        <span>{mission.hint || "提示文案…"}</span>
      </div>
      <footer>
        <Award size={16} />
        <div>
          <strong>{mission.badge || "徽章名"}</strong>
          <p>{mission.reflection || "反思文案…"}</p>
        </div>
      </footer>
    </article>
  );
}
