import { Award, BookOpenCheck, Lightbulb, ListChecks, Sparkles } from "lucide-react";

const TEMPLATE_LABELS = {
  DATA_LABELING: "数据标注训练",
  PREDICTION_BRANCH: "预测与条件分支",
  LOOP_ROUTE: "循环路线",
  CONFIDENCE_GATE: "置信度门槛",
  AGENT_PATROL: "智能体巡检",
  DATA_BALANCE: "数据均衡与公平",
  QUIZ_GAME: "AI 知识闯关",
  SEQUENCE_STORY: "顺序故事绘本",
};

const THEME_LABELS = {
  labeling: "数据标注训练",
  predict: "预测与条件分支",
  route: "循环路线",
  confidence: "置信度门槛",
  patrol: "智能体巡检",
  balance: "数据均衡与公平",
  quiz: "AI 知识闯关",
  story: "顺序故事绘本",
};

export function MissionHoverPreview({ mission, completed }) {
  if (!mission) return null;

  const templateLabel = TEMPLATE_LABELS[mission.templateCode]
    || THEME_LABELS[mission.theme]
    || "图形化关卡";
  const order = mission.order ?? mission.sortOrder ?? "?";
  const concepts = (mission.concepts || []).filter(Boolean);
  const steps = (mission.steps || []).filter(Boolean);

  return (
    <article className={`visual-mission-hover-card theme-${mission.theme || "labeling"}`}>
      <header>
        <span className={`visual-mission-hover-chip ${completed ? "done" : "todo"}`}>
          {completed ? `已通关 ${completed.stars || 0}/3` : "未通关"}
        </span>
        <small>{templateLabel}</small>
      </header>
      <div className="visual-mission-hover-hero">
        <span className="visual-mission-hover-orb" aria-hidden="true" />
        <div>
          <p className="eyebrow">第 {order} 关 · {mission.shortTitle || "短标题"}</p>
          <h3>{mission.title || "关卡标题"}</h3>
          <p>{mission.description || ""}</p>
        </div>
      </div>
      {mission.story && (
        <div className="visual-mission-hover-story">
          <BookOpenCheck size={16} />
          <p>{mission.story}</p>
        </div>
      )}
      <div className="visual-mission-hover-goal">
        <strong>过关目标</strong>
        <p>{mission.goal || ""}</p>
        {concepts.length > 0 && (
          <div className="visual-mission-hover-tags">
            {concepts.map((item) => <span key={item}>{item}</span>)}
          </div>
        )}
      </div>
      {steps.length > 0 && (
        <div className="visual-mission-hover-steps">
          <ListChecks size={16} />
          <ol>
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
      {mission.hint && (
        <div className="visual-mission-hover-hint">
          <Lightbulb size={15} />
          <span>{mission.hint}</span>
        </div>
      )}
      {(mission.badge || mission.reflection) && (
        <footer>
          <Award size={16} />
          <div>
            <strong>{mission.badge || "通关徽章"}</strong>
            {mission.reflection && <p>{mission.reflection}</p>}
          </div>
        </footer>
      )}
      <div className="visual-mission-hover-foot">
        <Sparkles size={13} />
        <span>点击进入本关</span>
      </div>
    </article>
  );
}
