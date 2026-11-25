import { Bot, CircleDot, ClipboardCheck, FlaskConical, ListChecks, MessageSquareText, Puzzle, Sparkles, Target } from "lucide-react";

const PHASE_LABELS = { LOOK: "先看看", THINK: "想一想", TRY: "试一试" };
const ARTIFACT_META = {
  QUIZ: { icon: Puzzle, label: "课堂小测" },
  ANIMATION: { icon: FlaskConical, label: "动画演示" },
  COURSEWARE: { icon: ListChecks, label: "互动课件" },
};
const EVIDENCE_META = {
  PRACTICE_QUIZ: { label: "AI 小测", tone: "practice", icon: ClipboardCheck },
  TUTOR_CHAT: { label: "教学对话", tone: "tutor", icon: MessageSquareText },
  DIAGNOSTIC: { label: "学情诊断", tone: "diagnostic", icon: Target },
};

/**
 * 工作台右栏「课堂面板」（需求 §4.1B + §11.3）：
 * 看得见 AI 正在做什么（五阶段）、为什么这样做（依据行）、结果如何影响下一步（产物+下一步）。
 * 底部附最近学习证据，与「我的成长」页同源。
 */
export function WorkspacePanel({ lesson, why, fallbackNext = [], evidence = [], onAskTopic }) {
  const artifacts = Array.isArray(lesson?.artifacts) ? lesson.artifacts : [];
  const nextTopics = (lesson?.nextTopics || []).filter(Boolean);
  const next = nextTopics.length ? nextTopics : fallbackNext;
  const progressTotal = Number(lesson?.progressTotal) || 0;
  const progressCurrent = Number(lesson?.progressCurrent) || 0;
  const topicTitle = lesson?.topicTitle || null;

  function scrollToMessage(messageKey) {
    const node = document.getElementById(messageKey);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <aside className="workspace-panel" aria-label="课堂面板">
      <section className="workspace-panel-block workspace-stage">
        <header><Bot size={15} />AI 正在做什么</header>
        <p className={`workspace-stage-label ${lesson?.busy ? "busy" : ""}`}>
          <i aria-hidden="true" />
          {lesson?.stageLabel || "在线"}
        </p>
      </section>

      <section className="workspace-panel-block">
        <header><CircleDot size={15} />本课任务</header>
        {topicTitle ? (
          <>
            <strong className="workspace-topic">{topicTitle}</strong>
            {progressTotal > 0 && (
              <p className="workspace-guided-progress">
                第 {Math.min(progressCurrent, progressTotal)}/{progressTotal} 步 ·{" "}
                {PHASE_LABELS[lesson?.phase] || "一起学"}
              </p>
            )}
          </>
        ) : (
          <p className="workspace-empty">还没开课。从左侧挑一个主题，或点一张图画卡片开始。</p>
        )}
        <p className="workspace-why-line">{why}</p>
      </section>

      <section className="workspace-panel-block">
        <header><ListChecks size={15} />课堂产物</header>
        {artifacts.length ? (
          <ul className="workspace-artifacts">
            {artifacts.map((artifact) => {
              const meta = ARTIFACT_META[artifact.kind] || ARTIFACT_META.ANIMATION;
              const Icon = meta.icon;
              return (
                <li key={`${artifact.kind}-${artifact.messageKey}`}>
                  <button type="button" onClick={() => scrollToMessage(artifact.messageKey)}>
                    <Icon size={14} />
                    <span>{artifact.title || meta.label}</span>
                    <small>{meta.label}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="workspace-empty">这节课生成的动画、小测会出现在这里。</p>
        )}
      </section>

      <section className="workspace-panel-block">
        <header><Sparkles size={15} />下一步</header>
        {next.length ? (
          <ul className="workspace-next">
            {next.slice(0, 4).map((item) => {
              const label = typeof item === "string" ? item : item.topic || item.title;
              if (!label) return null;
              return (
                <li key={label}>
                  <button type="button" onClick={() => onAskTopic?.(label)}>{label}</button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="workspace-empty">先完成上面的小测，下一步建议会更准。</p>
        )}
      </section>
      <section className="workspace-panel-block">
        <header><ClipboardCheck size={15} />学习证据</header>
        {evidence.length ? (
          <div className="evidence-timeline">
            {evidence.slice(0, 3).map((item) => {
              const meta = EVIDENCE_META[item.evidenceType] || EVIDENCE_META.TUTOR_CHAT;
              const Icon = meta.icon;
              return (
                <article className="evidence-row" key={item.id}>
                  <span className={`evidence-icon tone-${meta.tone}`}><Icon size={15} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{meta.label}{item.scorePercent != null ? ` · ${item.scorePercent}%` : " · 参与讨论"} · {formatEvidenceDate(item.createdTime)}</small>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="workspace-empty">完成小测、提问或诊断后，最近的学习记录会显示在这里。</p>
        )}
      </section>
    </aside>
  );
}

function formatEvidenceDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(date);
}
