import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Code2,
  Database,
  Flag,
  Gamepad2,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { visualProgrammingApi } from "../api/client.js";
import { readBlocklyProgress } from "../data/blocklyProgress.js";
import {
  DEFAULT_BLOCKLY_MISSIONS,
  normalizeMission,
} from "../data/blocklyMissions.js";
import {
  challengeParkSummary,
  groupChallengeMissions,
  missionChallengePoints,
} from "../data/challengePark.js";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

const CATEGORY_ICONS = {
  data: Database,
  "machine-learning": Brain,
  programming: Code2,
  creation: BookOpen,
  exploration: Sparkles,
};

export function ChallengeParkPage({ session, navigate, experience = EXPERIENCE.PRIMARY }) {
  const [missions, setMissions] = useState(DEFAULT_BLOCKLY_MISSIONS);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const progress = useMemo(() => readBlocklyProgress(session), [session]);
  const completed = progress.completed;
  const categories = useMemo(() => groupChallengeMissions(missions), [missions]);
  const summary = useMemo(() => challengeParkSummary(missions, completed), [missions, completed]);
  const visuals = visualsFor(experience);

  useEffect(() => {
    let active = true;
    setLoading(true);
    visualProgrammingApi.missions()
      .then((items) => {
        if (!active) return;
        const remote = (Array.isArray(items) ? items : [])
          .map(normalizeMission)
          .filter(Boolean)
          .sort((left, right) => (left.order || 0) - (right.order || 0));
        setMissions(remote.length ? remote : DEFAULT_BLOCKLY_MISSIONS);
        setUsingFallback(remote.length === 0);
      })
      .catch(() => {
        if (!active) return;
        setMissions(DEFAULT_BLOCKLY_MISSIONS);
        setUsingFallback(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function openMission(mission) {
    if (!mission) return;
    sessionStorage.setItem("k12-visual-mission", mission.id || mission.missionCode);
    navigate("visual-code-lab");
  }

  return (
    <div className="page inner-page challenge-park-page">
      <section className="challenge-park-hero">
        <div className="challenge-park-copy">
          <p className="eyebrow"><Gamepad2 size={15} />闯关乐园</p>
          <h1>闯一关，拿一颗星</h1>
          <p>每关都有一个小任务。答对、完成并获得星星，就能积累挑战积分。</p>
          <div className="challenge-park-stats" aria-label="我的闯关统计">
            <span><Zap size={16} /><small>挑战积分</small><strong>{summary.points}</strong></span>
            <span><Star size={16} /><small>星星</small><strong>{summary.stars}</strong></span>
            <span><Trophy size={16} /><small>通关主题</small><strong>{summary.passedCategories}/{summary.totalCategories}</strong></span>
          </div>
          <button
            className="button primary challenge-park-primary"
            type="button"
            disabled={loading || missions.length === 0}
            onClick={() => openMission(summary.nextMission || missions[0])}
          >
            <Play size={16} />{summary.completedMissions ? "继续闯关" : "开始第一关"}
          </button>
        </div>
        <div className="challenge-park-art" aria-hidden="true">
          <img src={visuals.tasks} alt="" />
          <span><Flag size={18} />每一颗星，都是学会的一件事</span>
        </div>
      </section>

      {usingFallback && !loading && (
        <p className="challenge-park-note">在线关卡暂时不可用，当前展示内置闯关内容。</p>
      )}

      {loading && (
        <div className="loading-state">
          <LoaderCircle className="spin" size={22} />正在准备闯关任务
        </div>
      )}

      {!loading && categories.map((category) => {
        const CategoryIcon = CATEGORY_ICONS[category.key] || Sparkles;
        const completedCount = category.missions.filter(
          (mission) => completed[mission.id] || completed[mission.missionCode],
        ).length;
        return (
          <section className={`challenge-category tone-${category.tone}`} key={category.key}>
            <header className="challenge-category-header">
              <span><CategoryIcon size={20} /></span>
              <div>
                <h2>{category.title}</h2>
                <p>{completedCount}/{category.missions.length} 关 · {category.description}</p>
              </div>
            </header>
            <div className="challenge-mission-grid">
              {category.missions.map((mission) => {
                const record = completed[mission.id] || completed[mission.missionCode];
                const stars = Math.min(3, Math.max(0, Number(record?.stars) || 0));
                return (
                  <article className={`challenge-mission-card${record ? " completed" : ""}`} key={mission.id}>
                    <div className="challenge-mission-topline">
                      <span>{record ? <CheckCircle2 size={16} /> : <Gamepad2 size={16} />}{record ? "已通关" : "待挑战"}</span>
                      <div className="challenge-mission-stars" aria-label={`${stars} 颗星`}>
                        {[1, 2, 3].map((value) => (
                          <Star
                            key={value}
                            size={17}
                            fill={value <= stars ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                    <h3>{mission.title}</h3>
                    <p>{mission.description}</p>
                    <footer>
                      <span>本关积分 <strong>{record ? missionChallengePoints(record) : 100}</strong></span>
                      <button type="button" onClick={() => openMission(mission)}>
                        {record ? <RotateCcw size={15} /> : <ArrowRight size={15} />}
                        {record ? "再挑战" : "开始挑战"}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {!loading && missions.length === 0 && (
        <section className="empty-state">
          <Gamepad2 size={34} />
          <h2>暂时没有已发布的闯关</h2>
          <p>教师发布关卡后，这里会自动出现新的挑战。</p>
        </section>
      )}
    </div>
  );
}
