import { Bot, ChevronDown, Code2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeachingAssistantChat } from "../components/TeachingAssistantChat.jsx";
import { topicsByCategory } from "../data/teachingTopics.js";

const RAIL_MIN = 220;
const RAIL_MAX = 440;
const RAIL_DEFAULT = 280;

export function AiStudioPage({
  session,
  displayName,
  requireLogin,
  navigate,
  draftRequest,
  onDraftConsumed,
  onPracticeRecorded,
}) {
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [seedPrompt, setSeedPrompt] = useState(null);
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const dragging = useRef(false);
  const layoutRef = useRef(null);
  const clearSeed = useCallback(() => setSeedPrompt(null), []);
  const topicGroups = topicsByCategory();

  useEffect(() => {
    if (!draftRequest?.topic || !session) return;
    setSeedPrompt({
      prompt: `请继续讲解${draftRequest.topic}，并给我一道新的练习题。`,
      preferDeterministic: false,
    });
    onDraftConsumed?.();
  }, [draftRequest, session, onDraftConsumed]);

  useEffect(() => {
    function onMove(event) {
      if (!dragging.current || !layoutRef.current) return;
      const left = layoutRef.current.getBoundingClientRect().left;
      const next = Math.min(RAIL_MAX, Math.max(RAIL_MIN, event.clientX - left));
      setRailWidth(next);
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("ai-studio-resizing");
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function toggleCategory(categoryId) {
    setOpenCategoryId((current) => (current === categoryId ? null : categoryId));
  }

  function pickTopic(topic) {
    requireLogin(() => {
      setActiveTopicId(topic.id);
      setOpenCategoryId(topic.category);
      setSeedPrompt({
        prompt: topic.prompt,
        topicId: topic.id,
        preferDeterministic: true,
      });
    });
  }

  function startResize(event) {
    event.preventDefault();
    dragging.current = true;
    document.body.classList.add("ai-studio-resizing");
  }

  return (
    <div className="page inner-page ai-studio-page">
      <header className="ai-studio-hero">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> AI 通识主课堂</p>
          <h1>AI 学习台</h1>
          <p>先点左侧分类标签展开主题，再点具体主题开始学习；右侧为固定可滚动对话窗。</p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => requireLogin(() => navigate("code-lab"))}
        >
          <Code2 size={16} />
          打开编程实验
        </button>
      </header>

      <div
        className="ai-studio-layout"
        ref={layoutRef}
        style={{ gridTemplateColumns: `${railWidth}px 6px minmax(0, 1fr)` }}
      >
        <aside className="ai-topic-rail" aria-label="推荐学习主题">
          <div className="ai-topic-rail-head">
            <Bot size={16} />
            <strong>主题目录</strong>
          </div>
          <p className="ai-topic-note">点击分类标签展开，再选择主题。</p>

          <div className="ai-topic-groups" role="list">
            {topicGroups.map((group) => {
              const expanded = openCategoryId === group.id;
              const panelId = `topic-panel-${group.id}`;
              return (
                <section
                  key={group.id}
                  className={`ai-topic-group tone-${group.tone} ${expanded ? "open" : ""}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="ai-topic-tag"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleCategory(group.id)}
                  >
                    <span className="tone-dot" aria-hidden="true" />
                    <span className="ai-topic-tag-copy">
                      <strong>{group.label}</strong>
                      <small>{group.blurb} · {group.topics.length} 个主题</small>
                    </span>
                    <ChevronDown size={16} className="ai-topic-chevron" aria-hidden="true" />
                  </button>
                  {expanded && (
                    <ul id={panelId}>
                      {group.topics.map((topic) => (
                        <li key={topic.id}>
                          <button
                            type="button"
                            className={activeTopicId === topic.id ? "active" : ""}
                            onClick={() => pickTopic(topic)}
                          >
                            <strong>{topic.label}</strong>
                            <span>{topic.hint}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <div className="ai-topic-foot">
            <p>同一时间只展开一个分类；自由提问仍可在右侧输入。</p>
          </div>
        </aside>

        <div
          className="ai-studio-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调节对话区宽度"
          aria-valuemin={RAIL_MIN}
          aria-valuemax={RAIL_MAX}
          aria-valuenow={railWidth}
          tabIndex={0}
          onMouseDown={startResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setRailWidth((value) => Math.max(RAIL_MIN, value - 16));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setRailWidth((value) => Math.min(RAIL_MAX, value + 16));
            }
          }}
        />

        <div className="ai-studio-main">
          {!session ? (
            <section className="ai-studio-gate">
              <Bot size={28} />
              <h2>登录后开始 AI 通识学习</h2>
              <p>登录后可按学段讲解、播放动画/步骤，并保存课堂小测结果。</p>
              <button className="button primary" type="button" onClick={() => requireLogin()}>
                登录学习台
              </button>
            </section>
          ) : (
            <TeachingAssistantChat
              session={session}
              displayName={displayName}
              onRequireLogin={() => requireLogin()}
              onPracticeRecorded={onPracticeRecorded}
              navigate={navigate}
              variant="page"
              activeTopicId={activeTopicId}
              onTopicChange={setActiveTopicId}
              seedPrompt={seedPrompt}
              onSeedConsumed={clearSeed}
            />
          )}
        </div>
      </div>
    </div>
  );
}
