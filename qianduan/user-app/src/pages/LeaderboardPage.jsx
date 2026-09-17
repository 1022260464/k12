import { Crown, LoaderCircle, Medal, RefreshCw, Trophy, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { leaderboardApi } from "../api/client.js";

const rankIcon = (rank) => {
  if (rank === 1) return <Crown size={19} aria-label="第一名" />;
  if (rank <= 3) return <Medal size={19} aria-label={`第${rank}名`} />;
  return <span>{rank}</span>;
};

export function LeaderboardPage({ session, requireLogin }) {
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

  if (!session) {
    return <div className="page inner-page"><header className="page-title"><p className="eyebrow">学习排行</p><h1>看看本周的学习进度</h1></header><section className="empty-state"><Trophy size={28} /><h2>登录后查看排行榜</h2><p>排行榜根据课程章节学习进度生成，只展示学习编号和积分。</p><button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button></section></div>;
  }

  return (
    <div className="page inner-page leaderboard-page">
      <header className="page-title page-title-row">
        <div><p className="eyebrow"><Trophy size={14} /> 学习排行</p><h1>用持续学习积累进步</h1><p>积分来自已报名课程的章节最高进度，不代表考试成绩。</p></div>
        <button className="button secondary" type="button" onClick={loadLeaderboard} disabled={loading}><RefreshCw size={16} />刷新</button>
      </header>

      {error && <p className="page-error" role="alert">{error}</p>}
      {loading && <div className="loading-state"><LoaderCircle size={22} />正在读取排行榜</div>}

      {!loading && !error && entries.length === 0 && <section className="empty-state"><UserRound size={28} /><h2>排行榜还没有数据</h2><p>报名课程并完成章节后，学习积分会出现在这里。</p></section>}

      {!loading && entries.length > 0 && <>
        <section className="leaderboard-summary" aria-label="我的排名">
          <div><small>我的当前排名</small><strong>{currentEntry ? `第 ${currentEntry.rank} 名` : "暂未进入前 20"}</strong></div>
          <div><small>我的学习积分</small><strong>{currentEntry ? currentEntry.learningPoints : "-"}</strong></div>
          <div><small>榜单更新时间</small><strong>{leaderboard?.generatedTime ? new Date(leaderboard.generatedTime).toLocaleString("zh-CN") : "-"}</strong></div>
        </section>

        <section className="leaderboard-list" aria-label="学习积分排行榜">
          <header><span>排名</span><span>学习者</span><span>学习积分</span></header>
          {entries.map((entry) => <article className={entry.currentUser ? "current" : ""} key={entry.userId}>
            <div className={`rank-badge rank-${entry.rank}`}>{rankIcon(entry.rank)}</div>
            <div className="learner-name"><span><UserRound size={17} /></span><strong>学习者 #{entry.userId}</strong>{entry.currentUser && <em>我</em>}</div>
            <strong className="learning-points">{entry.learningPoints}</strong>
          </article>)}
        </section>
        <p className="leaderboard-note">排行榜使用短时缓存以提升读取速度；缓存异常时系统会自动从业务数据库读取。</p>
      </>}
    </div>
  );
}
