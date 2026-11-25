import { Bot, ChevronDown, Code2, ClipboardCheck, GraduationCap, PlayCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeachingAssistantChat } from "../components/TeachingAssistantChat.jsx";
import { PrimaryLearningGuide } from "../components/PrimaryLearningGuide.jsx";
import { WorkspacePanel } from "../components/WorkspacePanel.jsx";
import { WorkspaceProfileBar } from "../components/WorkspaceProfileBar.jsx";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { requestChallengeFocus } from "./ChallengePage.jsx";
import { topicsByCategory } from "../data/teachingTopics.js";
import { primaryChatStarters } from "../data/primaryChatPictures.js";
import { knowledgeGraphApi, practiceApi, profileApi } from "../api/client.js";
import { buildLessonWhy, filterMasteryByStage } from "../utils/lessonWhy.js";
import { EXPERIENCE } from "../experience/experience.js";

const RAIL_MIN = 220;
const RAIL_MAX = 440;
const RAIL_DEFAULT = 280;
const PANEL_MIN = 240;
const PANEL_MAX = 380;
const PANEL_DEFAULT = 300;
// 中学端首屏热门问题：让 hero 不再只有一行标题，点一下就能开始提问。
// 小学端改用图画开场卡（primaryChatStarters），认字不多也能挑。
const QUICK_QUESTIONS = [
  "什么是机器学习？",
  "推荐算法怎么懂我？",
  "大模型是怎么工作的？",
  "学 AI 需要什么基础？",
];
export function AiStudioPage({
  session,
  displayName,
  requireLogin,
  navigate,
  draftRequest,
  onDraftConsumed,
  onPracticeRecorded,
  experience = EXPERIENCE.TEEN,
  schoolStage,
}) {
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [seedPrompt, setSeedPrompt] = useState(null);
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [lesson, setLesson] = useState(null);
  const [profileData, setProfileData] = useState({ ready: false, profile: null, mastery: [], insights: null, interests: [] });
  // null = 图谱还没取到；weakMastery 为 null 时画像条先不渲染薄弱 chip，避免跨学段闪现。
  const [graphPoints, setGraphPoints] = useState(null);
  const [gaps, setGaps] = useState([]);
  const dragging = useRef(false);
  const dragTarget = useRef("rail");
  const layoutRef = useRef(null);
  const clearSeed = useCallback(() => setSeedPrompt(null), []);
  const handleLessonState = useCallback((state) => setLesson(state), []);
  const primary = experience === EXPERIENCE.PRIMARY;
  const topicGroups = primary ? [] : topicsByCategory("teen");

  useEffect(() => {
    if (!draftRequest || !session) return;
    if (draftRequest.prompt) {
      setSeedPrompt({
        prompt: draftRequest.prompt,
        preferDeterministic: Boolean(draftRequest.preferDeterministic),
        topicId: draftRequest.topicId,
        topicCode: draftRequest.topicCode,
      });
      onDraftConsumed?.();
      return;
    }
    if (draftRequest.topic) {
      setSeedPrompt({
        prompt: `请继续讲解${draftRequest.topic}，并给我一道新的练习题。`,
        preferDeterministic: false,
      });
      onDraftConsumed?.();
    }
  }, [draftRequest, session, onDraftConsumed]);

  useEffect(() => {
    function onMove(event) {
      if (!dragging.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      if (dragTarget.current === "panel") {
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, rect.right - event.clientX));
        setPanelWidth(next);
        return;
      }
      const next = Math.min(RAIL_MAX, Math.max(RAIL_MIN, event.clientX - rect.left));
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

  // 画像摘要取数：三个现成接口先渲染画像条，谁失败就少显示谁（§4.1B）。
  // 图谱总览较大（400+ 点）单独取，到位后再过滤薄弱 chip，不拖慢画像条首屏。
  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.allSettled([profileApi.getLearningProfile(), practiceApi.mastery(), practiceApi.insights()])
      .then(([profileResult, masteryResult, insightsResult]) => {
        if (!active) return;
        setProfileData({
          ready: true,
          profile: profileResult.status === "fulfilled" ? profileResult.value : null,
          mastery: masteryResult.status === "fulfilled" ? masteryResult.value || [] : [],
          insights: insightsResult.status === "fulfilled" ? insightsResult.value : null,
          interests: (profileResult.status === "fulfilled" ? profileResult.value?.interests : []) || [],
        });
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    knowledgeGraphApi.overview()
      .then((value) => {
        if (active) setGraphPoints(value?.points || []);
      })
      .catch(() => {
        if (active) setGraphPoints([]);
      });
    return () => {
      active = false;
    };
  }, [session]);

  const focusTopicCode = lesson?.topicCode || null;
  useEffect(() => {
    if (!focusTopicCode || !profileData.mastery.length) {
      setGaps([]);
      return undefined;
    }
    let active = true;
    const masteryPairs = profileData.mastery
      .filter((item) => item?.knowledgeCode && Number.isFinite(item?.masteryPercent))
      .map((item) => `${item.knowledgeCode}:${Math.round(item.masteryPercent)}`);
    knowledgeGraphApi.prerequisiteGaps(focusTopicCode, masteryPairs)
      .then((value) => {
        if (active) setGaps(Array.isArray(value) ? value : []);
      })
      .catch(() => {
        if (active) setGaps([]);
      });
    return () => {
      active = false;
    };
  }, [focusTopicCode, profileData.mastery]);

  // 薄弱建议按学段过滤：起步学段高于当前学段的知识点不冒进画像条与推荐理由；
  // 平均掌握仍用全量 mastery（前置缺口计算同样用全量，跨学段前置不能丢）。
  const stageMastery = filterMasteryByStage(
    profileData.mastery,
    profileData.profile?.schoolStage || schoolStage,
    graphPoints,
  );
  const lessonWhy = buildLessonWhy({
    topicTitle: lesson?.topicTitle || null,
    mastery: stageMastery,
    gaps,
    interests: profileData.interests,
  });
  const fallbackNext = (profileData.insights?.weakPoints || stageMastery)
    .filter((item) => Number.isFinite(item?.masteryPercent) ? item.masteryPercent < 70 : Boolean(item?.topic))
    .slice(0, 4)
    .map((item) => item.topic)
    .filter(Boolean);

  function toggleCategory(categoryId) {
    setOpenCategoryId((current) => (current === categoryId ? null : categoryId));
  }

  function pickTopic(topic) {
    requireLogin(() => {
      if (topic.route) {
        navigate(topic.route);
        return;
      }
      setActiveTopicId(topic.id);
      setOpenCategoryId(topic.category);
      setSeedPrompt({
        prompt: topic.prompt,
        topicId: topic.id,
        preferDeterministic: true,
      });
    });
  }

  function askPrimaryTopic(topic) {
    requireLogin(() => {
      setSeedPrompt({
        prompt: `我想继续学习「${topic}」。请用适合小学生的短句和生活例子讲解，再给我一个小挑战。`,
        preferDeterministic: false,
      });
    });
  }

  function askQuickQuestion(question) {
    requireLogin(() => {
      setSeedPrompt({
        prompt: `请给我讲讲：${question}`,
        preferDeterministic: false,
      });
    });
  }

  // 图画开场卡：孩子点图不点字；带上目录里的 topicCode，回答和证据都落在课程知识点上。
  function askStarter(starter) {
    requireLogin(() => {
      setSeedPrompt({
        prompt: starter.question,
        topicCode: starter.topicCode,
        preferDeterministic: true,
      });
    });
  }

  function startResize(target) {
    return (event) => {
      event.preventDefault();
      dragTarget.current = target;
      dragging.current = true;
      document.body.classList.add("ai-studio-resizing");
    };
  }

  return (
    <div className="page inner-page ai-studio-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={primary ? "小智陪伴课堂" : "云端研究学院 · AI 学习台"}
        title={primary ? "问问小智" : "AI 学习台"}
        description={primary ? "左边的图画卡片挑一张点一点，小智就用故事、例子和小挑战陪你学会它。" : "选择左侧主题开始学习；右侧对话窗可随时提问、看讲解与小测。"}
        imageKey="assistant"
      >
        {!primary && (
          <div className="hero-question-row" aria-label="热门问题，点击即可向小智提问">
            <span className="hero-question-label"><Sparkles size={13} />大家都在问</span>
            {QUICK_QUESTIONS.map((question) => (
              <button key={question} type="button" className="hero-question-chip" onClick={() => askQuickQuestion(question)}>
                {question}
              </button>
            ))}
          </div>
        )}
        <div className="ai-studio-hero-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => requireLogin(() => navigate(primary ? "visual-code-lab" : "code-lab"))}
          >
            <Code2 size={16} />
            {primary ? "去图形编程" : "打开编程实验"}
          </button>
        </div>
      </ExperiencePageHeader>

      <WorkspaceProfileBar
        profileData={session ? profileData : null}
        weakMastery={graphPoints === null ? null : stageMastery}
        why={lessonWhy}
        currentTopicTitle={lesson?.topicTitle || null}
        onOpenChallenge={(code) => {
          if (code) requestChallengeFocus(code);
          navigate("challenge");
        }}
      />

      <div
        className="ai-studio-layout"
        ref={layoutRef}
        style={{ "--studio-rail": `${railWidth}px`, "--studio-panel": `${panelWidth}px` }}
      >
        {primary ? (
          <div className="primary-ask-rail">
            <section className="primary-starter-panel" aria-label="挑一张图画，问问小智">
              <header className="primary-starter-head"><Sparkles size={15} />挑一张图，问问小智</header>
              <div className="primary-starter-list">
                {primaryChatStarters.map((starter) => (
                  <button key={starter.id} type="button" className="primary-starter-item" onClick={() => askStarter(starter)}>
                    <img src={starter.image} alt="" loading="lazy" />
                    <span>
                      <strong>{starter.label}</strong>
                      <small>{starter.question}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <PrimaryLearningGuide session={session} navigate={navigate} onAskTopic={askPrimaryTopic} schoolStage={schoolStage} requireLogin={requireLogin} />
          </div>
        ) : <aside className="ai-topic-rail" aria-label="推荐学习主题">
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
        </aside>}

        <div
          className="ai-studio-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调节对话区宽度"
          aria-valuemin={RAIL_MIN}
          aria-valuemax={RAIL_MAX}
          aria-valuenow={railWidth}
          tabIndex={0}
          onMouseDown={startResize("rail")}
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
              <span className="ai-studio-gate-icon"><Bot size={24} /></span>
              <h2>{primary ? "登录后，小智就能陪你学啦" : "登录后开始 AI 通识学习"}</h2>
              <p>{primary ? "小智会按你的学段来讲，还能陪你做课堂小测、安排下一步。" : "登录后可按学段讲解、播放动画/步骤，并保存课堂小测结果。"}</p>
              <button className="button primary" type="button" onClick={() => requireLogin()}>
                登录学习台
              </button>
              <div className="ai-studio-gate-features">
                <article>
                  <GraduationCap size={17} />
                  <strong>按学段讲解</strong>
                  <span>{primary ? "一年级有一年级的讲法，不会太难" : "内容深度跟随你的学习档案自动调整"}</span>
                </article>
                <article>
                  <PlayCircle size={17} />
                  <strong>动画与步骤演示</strong>
                  <span>{primary ? "看动画、跟着一步步动手做" : "抽象概念用动画和分步演示讲清楚"}</span>
                </article>
                <article>
                  <ClipboardCheck size={17} />
                  <strong>课堂小测记录</strong>
                  <span>{primary ? "做完小测，小智帮你安排复习" : "小测成绩自动归档到学习报告"}</span>
                </article>
              </div>
            </section>
          ) : (
            <TeachingAssistantChat
              session={session}
              displayName={displayName}
              onRequireLogin={() => requireLogin()}
              onPracticeRecorded={onPracticeRecorded}
              navigate={navigate}
              onOpenChallenge={() => navigate("challenge")}
              variant="page"
              activeTopicId={activeTopicId}
              onTopicChange={setActiveTopicId}
              seedPrompt={seedPrompt}
              onSeedConsumed={clearSeed}
              onLessonState={handleLessonState}
              agentCode={primary ? "lower-primary-tutor" : "teaching-assistant"}
            />
          )}
        </div>

        <div
          className="ai-studio-resizer panel"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调节课堂面板宽度"
          aria-valuemin={PANEL_MIN}
          aria-valuemax={PANEL_MAX}
          aria-valuenow={panelWidth}
          tabIndex={0}
          onMouseDown={startResize("panel")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setPanelWidth((value) => Math.min(PANEL_MAX, value + 16));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setPanelWidth((value) => Math.max(PANEL_MIN, value - 16));
            }
          }}
        />

        <WorkspacePanel
          lesson={lesson}
          why={lessonWhy}
          fallbackNext={fallbackNext}
          onAskTopic={primary ? askPrimaryTopic : askQuickQuestion}
        />
      </div>
    </div>
  );
}
