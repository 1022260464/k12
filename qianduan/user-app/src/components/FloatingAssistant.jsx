import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

/** 悬浮入口：跳转到 AI 学习台主页面，避免与整页双开对话状态。 */

export function FloatingAssistant({ page, session, navigate, onRequireLogin, experience = EXPERIENCE.TEEN }) {
  if (page === "ai-studio") return null;
  const primary = experience === EXPERIENCE.PRIMARY;
  const assistantIcon = visualsFor(experience).mascot;

  return (
    <aside className="floating-assistant" aria-label="打开 AI 学习台">
      <button
        className="assistant-launcher"
        type="button"
        aria-label={primary ? "问问小智" : "打开 AI 学习台"}
        data-label={primary ? "问问小智" : "AI 学习台"}
        onClick={() => {
          if (!session) {
            onRequireLogin();
            return;
          }
          navigate("ai-studio");
        }}
      >
        <img src={assistantIcon} alt="" width={48} height={48} />
      </button>
    </aside>
  );
}
