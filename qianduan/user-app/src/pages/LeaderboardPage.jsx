import { Clap, Crown, Trophy } from "duma-icons-react";
import { Flame, LoaderCircle, RefreshCw, ShieldCheck, Target, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { leaderboardApi } from "../api/client.js";
import { AuthGateShowcase } from "../components/AuthGateShowcase.jsx";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

export function LeaderboardPage({ session, requireLogin, experience = EXPERIENCE.TEEN }) {
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      setLeaderboard(await leaderboardApi.get(20));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      setLeaderboard(null);
      return;
    }
    loadLeaderboard();
  }, [loadLeaderboard, session]);

  const entries = leaderboard?.entries || [];
  const currentEntry = useMemo(() => entries.find((entry) => entry.currentUser), [entries]);
  const pageVisual = visualsFor(experience).progress;

  if (!session) {
    return (
      <div className="page inner-page leaderboard-page">
        <LeaderboardHero experience={experience} />
        <AuthGateShowcase
          title="登录后查看排行榜"
          description="排行榜积分 = 课程章节进度 + 知识闯关积分，只展示匿名编号和积分。"
          features={[
            { icon: Target, title: "章节进度换积分", text: "报名课程的章节最高进度决定课程积分。" },
            { icon: Flame, title: "闯关再拿一笔", text: "去知识闯关答题，成绩直接换算成挑战积分。" },
            { icon: ShieldCheck, title: "匿名编号展示", text: "不公开昵称和头像，保护个人隐私。" },
          ]}
          onLogin={() => requireLogin()}
        />
      </div>
    );
  }

  return (
    <div className="page inner-page leaderboard-page">
      <LeaderboardHero experience={experience}>
        <button className="button secondary" type="button" onClick={loadLeaderboard} disabled={loading}>
          <RefreshCw size={16} />刷新
        </button>
      </LeaderboardHero>

      {error && <p className="page-error" role="alert">{error}</p>}
      {loading && <div className="loading-state"><LoaderCircle size={22} />正在读取排行榜</div>}

      {!loading && !error && entries.length === 0 && (
        <section className="empty-state">
          <img className="leaderboard-empty-mascot" src={pageVisual} alt="" />
          <h2>排行榜还没有数据</h2>
          <p>报名课程、完成章节或去知识闯关答题，积分会出现在这里。</p>
        </section>
      )}

      {!loading && entries.length > 0 && (
        <>
          <section className="leaderboard-summary" aria-label="我的排名">
            <div><small>我的当前排名</small><strong>{currentEntry ? `第 ${currentEntry.rank} 名` : "暂未进入前 20"}</strong></div>
            <div><small>我的学习积分</small><strong>{currentEntry ? currentEntry.learningPoints : "-"}</strong></div>
            <div><small>榜单更新时间</small><strong>{leaderboard?.generatedTime ? new Date(leaderboard.generatedTime).toLocaleString("zh-CN") : "-"}</strong></div>
          </section>

          <section className="leaderboard-list" aria-label="学习积分排行榜">
            <header><span>排名</span><span>学习者</span><span>学习积分</span></header>
            {entries.map((entry) => (
              <article className={entry.currentUser ? "current" : ""} key={entry.userId}>
                <div className={`rank-badge rank-${entry.rank}`}>{rankVisual(entry.rank)}</div>
                <div className="learner-name">
                  <span><UserRound size={17} /></span>
                  <strong>学习者 {entry.userId}</strong>
                  {entry.currentUser && <em>我</em>}
                </div>
                <strong className="learning-points">{entry.learningPoints}</strong>
              </article>
            ))}
          </section>
          <p className="leaderboard-note">积分 = 课程章节进度 + 知识闯关积分；排行榜大约每隔几分钟更新一次，闯关后稍等片刻就会上榜。</p>
        </>
      )}
    </div>
  );
}

function rankVisual(rank) {
  if (rank === 1) return <Trophy size={22} className="rank-doodle" title="第一名" />;
  if (rank === 2) return <Crown size={20} className="rank-doodle" title="第二名" />;
  if (rank === 3) return <Clap size={20} className="rank-doodle" title="第三名" />;
  return <span>{rank}</span>;
}

function LeaderboardHero({ experience, children }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  return (
    <ExperiencePageHeader
      experience={experience}
      eyebrow={primary ? "成长排行" : "学习排行"}
      title={primary ? "每一次坚持都值得一颗星" : "用持续学习积累进步"}
      description={primary ? "完成课程和闯关挑战都能积累成长积分，和昨天的自己比一比。" : "积分 = 已报名课程的章节进度 + 知识闯关积分，不代表考试成绩。"}
      imageKey="progress"
    >
      {children && <div className="leaderboard-hero-actions">{children}</div>}
    </ExperiencePageHeader>
  );
}
