import { Activity, Bot, BookOpen, ClipboardCheck, Network, RefreshCw, Server, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi, coursesApi, healthApi, homeworksApi, knowledgeGraphApi, usersApi } from "../api/client.js";

export function OverviewPage({ notify, onNavigate }) {
  const [counts, setCounts] = useState({ users: 0, courses: 0, agents: 0, homeworks: 0, kgPoints: 0, kgEdges: 0, kgCovers: 0 });
  const [services, setServices] = useState([]);
  const [graphReady, setGraphReady] = useState(false);
  const [fastLoading, setFastLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(true);

  async function loadFast() {
    setFastLoading(true);
    const [users, courses, agents, homeworks, health] = await Promise.allSettled([
      usersApi.list(),
      coursesApi.list(),
      agentsApi.list(),
      homeworksApi.list(),
      healthApi.all(),
    ]);
    setCounts((prev) => ({
      ...prev,
      users: valueLength(users),
      courses: valueLength(courses),
      agents: valueLength(agents),
      homeworks: valueLength(homeworks),
    }));
    if (health.status === "fulfilled") {
      setServices(health.value.map((result, index) => ({
        name: ["Gateway", "IAM", "Learning", "Agent", "Assessment"][index],
        up: result.status === "fulfilled",
      })));
    }
    if ([users, courses, agents, homeworks].some((result) => result.status === "rejected")) {
      notify("部分服务暂时无法读取，请检查后端启动状态", "error");
    }
    setFastLoading(false);
  }

  async function loadGraph() {
    setGraphLoading(true);
    try {
      const graphData = await knowledgeGraphApi.overview();
      setCounts((prev) => ({
        ...prev,
        kgPoints: graphData?.points?.length || 0,
        kgEdges: graphData?.edges?.length || 0,
        kgCovers: graphData?.chapterCovers?.length || 0,
      }));
      setGraphReady(Boolean(graphData?.status?.ready));
    } catch {
      setCounts((prev) => ({ ...prev, kgPoints: 0, kgEdges: 0, kgCovers: 0 }));
      setGraphReady(false);
    } finally {
      setGraphLoading(false);
    }
  }

  function load() {
    loadFast();
    loadGraph();
  }

  useEffect(() => { load(); }, []);

  const metrics = [
    ["用户", counts.users, Users, fastLoading],
    ["课程", counts.courses, BookOpen, fastLoading],
    ["智能体", counts.agents, Bot, fastLoading],
    ["作业", counts.homeworks, ClipboardCheck, fastLoading],
    ["知识节点", counts.kgPoints, Network, graphLoading],
  ];

  return (
    <section className="page-section">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PLATFORM OVERVIEW</p>
          <h1>工作台</h1>
          <p>查看业务资源数量、图谱规模与后端服务连接状态。</p>
        </div>
        <button className="button ghost" type="button" onClick={load}>
          <RefreshCw size={17} />刷新
        </button>
      </header>

      <div className="overview-metrics">
        {metrics.map(([label, value, Icon, pending]) => (
          <article key={label}>
            <span><Icon size={20} /></span>
            <div>
              <strong>{pending ? "…" : value}</strong>
              <small>{label}{pending ? " · 加载中" : ""}</small>
            </div>
          </article>
        ))}
      </div>

      <button
        className={`teacher-kg-card${graphLoading ? " is-loading" : ""}`}
        type="button"
        onClick={() => !graphLoading && onNavigate?.("knowledge")}
        disabled={graphLoading}
      >
        <span className="teacher-stat-icon"><Network size={22} /></span>
        <div className="teacher-stat-copy">
          <strong>
            {graphLoading ? "知识图谱加载中…" : (graphReady ? "Neo4j 图谱已连通" : "知识图谱")}
          </strong>
          <small>力导向关系图 · 学段/类别统计 · 章节 COVERS 覆盖率</small>
          <div className="teacher-kg-metrics">
            <span>节点 {graphLoading ? "加载中" : counts.kgPoints}</span>
            <span>关系 {graphLoading ? "加载中" : counts.kgEdges}</span>
            <span>章节覆盖 {graphLoading ? "加载中" : counts.kgCovers}</span>
          </div>
        </div>
      </button>

      <div className="overview-grid">
        <section className="data-panel service-panel">
          <header>
            <div><Server size={19} /><strong>服务状态</strong></div>
            <span>
              {fastLoading
                ? "检查中…"
                : `${services.filter((item) => item.up).length} / 5 可用`}
            </span>
          </header>
          <div>
            {fastLoading
              ? <p className="empty-row">正在检查服务...</p>
              : services.length
                ? services.map((service) => (
                  <p key={service.name}>
                    <span><i className={service.up ? "up" : "down"} />{service.name}</span>
                    <strong>{service.up ? "正常" : "不可用"}</strong>
                  </p>
                ))
                : <p className="empty-row">暂无服务状态</p>}
          </div>
        </section>
        <section className="data-panel console-note">
          <ShieldCheck size={24} />
          <h2>权限由后端统一校验</h2>
          <p>管理端按钮只提供操作入口。Gateway、Spring Security 和方法权限注解仍是最终访问边界。</p>
          <span><Activity size={15} />所有写操作都会进入管理审计</span>
        </section>
      </div>
    </section>
  );
}

function valueLength(result) {
  return result.status === "fulfilled" ? (result.value?.items || result.value || []).length : 0;
}
