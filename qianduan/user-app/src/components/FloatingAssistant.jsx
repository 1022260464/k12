/** 悬浮入口：跳转到 AI 学习台主页面，避免与整页双开对话状态。 */
const ASSISTANT_ICON = "/assets/ai-assistant-doodle.png";

export function FloatingAssistant({ page, session, navigate, onRequireLogin }) {
  if (page === "ai-studio") return null;

  return (
    <aside className="floating-assistant" aria-label="打开 AI 学习台">
      <button
        className="assistant-launcher"
        type="button"
        aria-label="打开 AI 学习台"
        data-label="AI 学习台"
        onClick={() => {
          if (!session) {
            onRequireLogin();
            return;
          }
          navigate("ai-studio");
        }}
      >
        <img src={ASSISTANT_ICON} alt="" width={36} height={36} />
      </button>
    </aside>
  );
}
