import { useState } from "react";
import { ChevronDown, HelpCircle, Sparkles, TrendingUp, Zap } from "lucide-react";
import { challengePointsTotal, topWeakPoints } from "../utils/lessonWhy.js";

const STAGE_LABELS = {
  PRIMARY_LOWER: "小学低年级",
  PRIMARY_UPPER: "小学高年级",
  JUNIOR_HIGH: "初中",
  SENIOR_HIGH: "高中",
};

function formatGradeLabel(profile) {
  const stage = STAGE_LABELS[profile?.schoolStage] || "";
  const grade = Number(profile?.grade);
  const numbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  if (Number.isInteger(grade) && grade >= 1 && grade <= 12) {
    const prefix = grade <= 6 ? "小学" : grade <= 9 ? "初中" : "高中";
    return `${prefix}${numbers[grade - 1]}年级`;
  }
  return stage;
}

/**
 * 工作台顶部画像摘要（需求 §4.1B）：学生是谁、水平如何、为什么安排此任务。
 * 数据全部来自现成接口，缺哪块就少显示哪块，不阻塞工作台。
 */
export function WorkspaceProfileBar({ profileData, weakMastery, why, currentTopicTitle, onOpenChallenge }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const { profile, mastery, interests, ready } = profileData || {};
  // 薄弱点按学段过滤（跨学段历史不冒出来）；平均掌握保留全量练习历史。
  // weakMastery 为 null 表示学段信息还没就绪，先不渲染薄弱 chip。
  const weak = weakMastery ? topWeakPoints(weakMastery, 3) : null;
  const rows = (Array.isArray(mastery) ? mastery : []).filter((item) => Number.isFinite(item?.masteryPercent));
  const average = rows.length
    ? Math.round(rows.reduce((sum, item) => sum + item.masteryPercent, 0) / rows.length)
    : null;
  // 挑战积分与闯关页/排行榜同一口径；没闯过关（0 分）就不占位置。
  const challengePoints = challengePointsTotal(mastery);

  return (
    <section className={`workspace-profile-bar${whyOpen ? " why-open" : ""}`} aria-label="学习画像摘要">
      <div className="workspace-profile-main">
        <span className="workspace-profile-avatar"><Sparkles size={16} /></span>
        <div className="workspace-profile-facts">
          <strong>{formatGradeLabel(profile) || "我的学习画像"}</strong>
          <div className="workspace-profile-chips">
            {(Array.isArray(interests) ? interests.slice(0, 3) : []).map((interest) => (
              <em key={interest}>{interest}</em>
            ))}
            {average !== null && (
              <span className="workspace-mastery"><TrendingUp size={13} />平均掌握 {average}%</span>
            )}
            {challengePoints > 0 && (
              <button
                type="button"
                className="workspace-challenge"
                onClick={onOpenChallenge}
                title="挑战积分已计入排行榜，点击去闯关拿更多"
              >
                <Zap size={13} />闯关积分 {challengePoints}
              </button>
            )}
            {(weak || []).map((item) => (
              <button
                type="button"
                className="workspace-weak"
                key={item.knowledgeCode || item.topic}
                onClick={() => onOpenChallenge?.(item.knowledgeCode)}
                title="去知识闯关，把这个薄弱点补牢"
              >
                薄弱·{item.topic || item.knowledgeCode} {Math.round(item.masteryPercent)}%
              </button>
            ))}
            {!ready && <span className="workspace-profile-loading">画像读取中…</span>}
          </div>
        </div>
      </div>
      <button
        className="workspace-why-toggle"
        type="button"
        aria-expanded={whyOpen}
        onClick={() => setWhyOpen((open) => !open)}
      >
        <HelpCircle size={15} />
        为什么安排此任务
        <ChevronDown size={14} className="workspace-why-caret" />
      </button>
      {whyOpen && (
        <div className="workspace-why-panel" role="note">
          <strong>{currentTopicTitle ? `当前任务：${currentTopicTitle}` : "还没开始上课"}</strong>
          <p>{why}</p>
          <small>依据你的练习掌握度、知识图谱前置关系和学习画像生成，会随学习进展自动更新。</small>
        </div>
      )}
    </section>
  );
}
