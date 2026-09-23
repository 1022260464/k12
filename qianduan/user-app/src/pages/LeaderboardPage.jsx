import { Clap, Crown, Trophy } from "duma-icons-react";
import { LoaderCircle, RefreshCw, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { leaderboardApi } from "../api/client.js";
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
        <section className="empty-state">
          <img className="leaderboard-empty-mascot" src={pageVisual} alt="" />
          <h2>登录后查看排行榜</h2>
          <p>排行榜根据课程章节学习进度生成，只展示匿名编号和积分。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page inner-page leaderboard-page">
      <header className="page-title page-title-row leaderboard-title-row">
        <LeaderboardHero experience={experience} />
        <button className="button secondary" type="button" onClick={loadLeaderboard} disabled={loading}>
          <RefreshCw size={16} />刷新
        </button>
      </header>

      {error && <p className="page-error" role="alert">{error}</p>}
      {loading && <div className="loading-state"><LoaderCircle size={22} />正在读取排行榜</div>}

      {!loading && !error && entries.length === 0 && (
        <section className="empty-state">
          <img className="leaderboard-empty-mascot" src={pageVisual} alt="" />
          <h2>排行榜还没有数据</h2>
          <p>报名课程并完成章节后，学习积分会出现在这里。</p>
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
          <p className="leaderboard-note">排行榜大约每隔几分钟更新一次。</p>
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

function LeaderboardHero({ experience }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  return (
    <div className="leaderboard-hero">
      <div className="leaderboard-mascot" aria-hidden="true">
        <img src={visualsFor(experience).progress} alt="" />
      </div>
      <div className="leaderboard-hero-copy">
        <p className="eyebrow">{primary ? "成长排行" : "学习排行"}</p>
        <h1>{primary ? "每一次坚持都值得一颗星" : "用持续学习积累进步"}</h1>
        <p>{primary ? "完成课程和挑战可以积累成长积分，和昨天的自己比一比。" : "积分来自已报名课程的章节最高进度，不代表考试成绩。"}</p>
      </div>
    </div>
  );
}
