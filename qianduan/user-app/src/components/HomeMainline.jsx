import { ArrowRight, ChevronRight, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { homeworksApi, practiceApi } from "../api/client.js";
import { EXPERIENCE } from "../experience/experience.js";

/**
 * 首页学习主线（评委 5 秒看懂的那一行）：
 * 今日任务 → 当前进度 → 下一步。三个节点都可点击直达。
 * 数据取现成接口，谁失败就只少显示谁，不打扰正常使用。
 */
export function HomeMainline({ session, navigate, onAskTopic, experience = EXPERIENCE.TEEN, historyItems = [] }) {
  const [data, setData] = useState({ ready: false, pendingCount: null, weakest: null });

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    Promise.allSettled([homeworksApi.list(), homeworksApi.learningResults(1, 100), practiceApi.mastery()])
      .then(([homeworkResult, resultsResult, masteryResult]) => {
        if (!active) return;
        const homeworks = Array.isArray(homeworkResult.value) ? homeworkResult.value : (homeworkResult.value?.items || []);
        const submissions = resultsResult.value?.items || resultsResult.value || [];
        const submissionsByHomework = new Map(
          (Array.isArray(submissions) ? submissions : []).filter((item) => item?.homeworkId != null).map((item) => [item.homeworkId, item]),
        );
        // 与 buildDailyLearningPlan 同一判定：已发布且未提交/被退回才算待完成。
        const pendingCount = homeworks.filter((item) => {
          const submission = submissionsByHomework.get(item.id);
          return item.status === "PUBLISHED" && (!submission || submission.status === "RETURNED");
        }).length;
        const weakest = (Array.isArray(masteryResult.value) ? masteryResult.value : [])
          .filter((item) => item?.knowledgeCode)
          .sort((left, right) => Number(left.masteryPercent || 0) - Number(right.masteryPercent || 0))[0] || null;
        setData({ ready: true, pendingCount, weakest });
      });
    return () => { active = false; };
  }, [session]);

  if (!session) return null;
  const primary = experience === EXPERIENCE.PRIMARY;

  const learning = historyItems.filter((item) => Number(item.progressPercent || 0) >= 0);
  const averageProgress = learning.length
    ? Math.round(learning.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / learning.length)
    : 0;
  const next = data.weakest
    ? {
      value: primary ? `巩固「${data.weakest.topic || data.weakest.knowledgeCode}」` : `巩固薄弱点：${data.weakest.topic || data.weakest.knowledgeCode}`,
      onClick: () => onAskTopic?.({ code: data.weakest.knowledgeCode, title: data.weakest.topic || data.weakest.knowledgeCode }),
    }
    : learning.find((item) => Number(item.progressPercent || 0) < 100)
      ? {
        value: `继续《${learning.find((item) => Number(item.progressPercent || 0) < 100).courseTitle}》`,
        onClick: () => navigate(`courses/${learning.find((item) => Number(item.progressPercent || 0) < 100).courseId}`),
      }
      : { value: primary ? "挑一个新探险开始" : "挑一门课程开始", onClick: () => navigate("courses") };

  const nodes = [
    {
      key: "tasks",
      icon: ListChecks,
      label: "今日任务",
      value: data.ready === false ? "查看任务" : (data.pendingCount ? `待完成 ${data.pendingCount} 件` : (primary ? "都完成啦，真棒！" : "全部完成，可以拓展了")),
      onClick: () => navigate("tasks"),
    },
    {
      key: "progress",
      icon: TrendingUp,
      label: "当前进度",
      value: learning.length ? `在学 ${learning.length} 门 · 平均 ${averageProgress}%` : (primary ? "还没开始，从 0 出发" : "尚无学习记录"),
      onClick: () => navigate("progress"),
    },
    { key: "next", icon: Sparkles, label: "下一步", value: next.value, onClick: next.onClick },
  ];

  return (
    <section className={`home-mainline ${primary ? "home-mainline-primary" : "home-mainline-teen"}`} aria-label="学习主线：今日任务、当前进度与下一步">
      <span className="home-mainline-title">{primary ? "今天的探险路线" : "学习主线"}</span>
      <ol className="home-mainline-track">
        {nodes.flatMap((node, index) => {
          const Icon = node.icon;
          const item = (
            <li key={node.key} className="home-mainline-item">
              <button type="button" className="home-mainline-node" onClick={node.onClick}>
                <span className="home-mainline-node-icon"><Icon size={17} /></span>
                <span className="home-mainline-copy">
                  <small>{node.label}</small>
                  <strong>{node.value}</strong>
                </span>
                <ArrowRight size={14} className="home-mainline-go" aria-hidden="true" />
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
