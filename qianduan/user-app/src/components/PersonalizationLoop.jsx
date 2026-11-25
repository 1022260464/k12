import { ClipboardCheck, Sparkles, Target, TrendingUp, UserRound } from "lucide-react";
import { ChevronRight, ArrowRight } from "lucide-react";
import { EXPERIENCE, learningProfileLabel } from "../experience/experience.js";

const round = (value) => Math.round(Number(value || 0));

/**
 * 个性化学习闭环（评委视角的"为什么是这条推荐"）：
 * 学段画像 → 答题记录 → 掌握度 → 推荐理由 → 下一步任务。
 * 数据全部来自 ProgressPage 已加载的真实接口；某一环没数据就显示灰态，不编造。
 */
export function PersonalizationLoop({ profile, knowledgeMastery = [], practiceInsights = [], history = [], experience = EXPERIENCE.TEEN, onOpenProfile, onPractice, navigate }) {
  const primary = experience === EXPERIENCE.PRIMARY;

  // 掌握度：只统计真实练过的知识点（attemptCount>0），避免"0 次练习=0%"拉低均值。
  const practiced = knowledgeMastery.filter((item) => Number(item?.attemptCount || 0) > 0);
  const attempts = practiced.reduce((sum, item) => sum + Number(item.attemptCount || 0), 0);
  const avgMastery = practiced.length
    ? round(practiced.reduce((sum, item) => sum + Number(item.masteryPercent || 0), 0) / practiced.length)
    : null;
  const weakest = practiced.length
    ? [...practiced].sort((left, right) => Number(left.masteryPercent || 0) - Number(right.masteryPercent || 0))[0]
    : null;
  const latestInsight = practiceInsights[0] || null;

  const stageValue = profile
    ? [learningProfileLabel(profile), profile.interests?.length ? `兴趣：${profile.interests.slice(0, 2).join("、")}` : ""].filter(Boolean).join(" · ")
    : "完善档案后更准";
  const recordValue = attempts
    ? `累计练习 ${attempts} 题${latestInsight ? ` · 最近 ${latestInsight.sampleCount} 次均分 ${round(latestInsight.averageScorePercent)}%` : ""}`
    : (latestInsight ? `最近 ${latestInsight.sampleCount} 次 · 均分 ${round(latestInsight.averageScorePercent)}%` : "还没有练习记录");
  const masteryValue = avgMastery == null
    ? "练一练就有啦"
    : `平均 ${avgMastery}%${weakest ? ` · 最弱「${weakest.topic || weakest.knowledgeCode}」${round(weakest.masteryPercent)}%` : ""}`;

  // 推荐理由：真实数字说话——最弱知识点 + 它是后续主题的前置。
  const reasonText = weakest
    ? `「${weakest.topic || weakest.knowledgeCode}」掌握度 ${round(weakest.masteryPercent)}%，低于 80% 目标线，先巩固它`
    : (latestInsight?.suggestion
      ? latestInsight.suggestion
      : (avgMastery != null
        ? `平均掌握度 ${avgMastery}%，基础较扎实，可以进入下一课`
        : "完成一次小测或诊断后，这里会用真实数据解释推荐"));

  const inProgress = history.find((item) => Number(item.progressPercent || 0) < 100);
  const nextValue = weakest
    ? `练「${weakest.topic || weakest.knowledgeCode}」`
    : (inProgress ? `继续《${inProgress.courseTitle}》` : (primary ? "选一个新探险" : "选一门课程开始"));

  const scrollTo = (selector) => {
    const target = document.querySelector(selector);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const nodes = [
    {
      key: "stage",
      icon: UserRound,
      label: "① 学段画像",
      value: stageValue,
      onClick: () => onOpenProfile?.(),
    },
    {
      key: "record",
      icon: ClipboardCheck,
      label: "② 答题记录",
      value: recordValue,
      onClick: () => scrollTo(".practice-insight-panel"),
    },
    {
      key: "mastery",
      icon: Target,
      label: "③ 掌握度",
      value: masteryValue,
      onClick: () => scrollTo(".learner-kg-panel"),
    },
    {
      key: "reason",
      icon: Sparkles,
      label: "④ 推荐理由",
      value: reasonText,
      wide: true,
    },
    {
      key: "next",
      icon: TrendingUp,
      label: "⑤ 下一步任务",
      value: nextValue,
      accent: true,
      onClick: () => {
        if (weakest) onPractice?.(weakest.topic || weakest.knowledgeCode);
        else if (inProgress) navigate?.(`courses/${inProgress.courseId}`);
        else navigate?.("courses");
      },
    },
  ];

  return (
    <section className={`home-mainline home-mainline-loop ${primary ? "home-mainline-primary" : "home-mainline-teen"}`} aria-label="个性化学习闭环：学段画像、答题记录、掌握度、推荐理由与下一步任务">
      <span className="home-mainline-title">{primary ? "我的学习闭环" : "个性化学习闭环"}</span>
      <ol className="home-mainline-track">
        {nodes.flatMap((node, index) => {
          const Icon = node.icon;
          const item = (
            <li key={node.key} className={`home-mainline-item${node.wide ? " loop-item-wide" : ""}`}>
              <button
                type="button"
                className={`home-mainline-node${node.accent ? " loop-node-accent" : ""}`}
                onClick={node.onClick}
                title={node.value}
              >
                <span className="home-mainline-node-icon"><Icon size={17} /></span>
                <span className="home-mainline-copy">
                  <small>{node.label}</small>
                  <strong className="loop-node-value">{node.value}</strong>
                </span>
                {node.onClick && <ArrowRight size={14} className="home-mainline-go" aria-hidden="true" />}
              </button>
            </li>
          );
          if (index === 0) return [item];
          return [
            <li key={`${node.key}-sep`} className="home-mainline-sep" aria-hidden="true"><ChevronRight size={16} /></li>,
            item,
          ];
        })}
      </ol>
    </section>
  );
}
