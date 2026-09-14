import { Activity, Bot, BookOpen, ClipboardCheck, RefreshCw, Server, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi, coursesApi, healthApi, homeworksApi, usersApi } from "../api/client.js";

export function OverviewPage({ notify }) {
  const [counts, setCounts] = useState({ users: 0, courses: 0, agents: 0, homeworks: 0 });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [users, courses, agents, homeworks, health] = await Promise.allSettled([usersApi.list(), coursesApi.list(), agentsApi.list(), homeworksApi.list(), healthApi.all()]);
    setCounts({ users: valueLength(users), courses: valueLength(courses), agents: valueLength(agents), homeworks: valueLength(homeworks) });
    if (health.status === "fulfilled") setServices(health.value.map((result, index) => ({ name: ["Gateway", "IAM", "Learning", "Agent", "Assessment"][index], up: result.status === "fulfilled" })));
    if ([users, courses, agents, homeworks].some((result) => result.status === "rejected")) notify("部分服务暂时无法读取，请检查后端启动状态", "error");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const metrics = [["用户", counts.users, Users], ["课程", counts.courses, BookOpen], ["智能体", counts.agents, Bot], ["作业", counts.homeworks, ClipboardCheck]];
  return <section className="page-section"><header className="page-heading"><div><p className="eyebrow">PLATFORM OVERVIEW</p><h1>工作台</h1><p>查看业务资源数量与后端服务连接状态。</p></div><button className="button ghost" type="button" onClick={load}><RefreshCw size={17} />刷新</button></header><div className="overview-metrics">{metrics.map(([label, value, Icon]) => <article key={label}><span><Icon size={20} /></span><div><strong>{loading ? "-" : value}</strong><small>{label}</small></div></article>)}</div><div className="overview-grid"><section className="data-panel service-panel"><header><div><Server size={19} /><strong>服务状态</strong></div><span>{services.filter((item) => item.up).length} / 5 可用</span></header><div>{services.length ? services.map((service) => <p key={service.name}><span><i className={service.up ? "up" : "down"} />{service.name}</span><strong>{service.up ? "正常" : "不可用"}</strong></p>) : <p className="empty-row">正在检查服务...</p>}</div></section><section className="data-panel console-note"><ShieldCheck size={24} /><h2>权限由后端统一校验</h2><p>管理端按钮只提供操作入口。Gateway、Spring Security 和方法权限注解仍是最终访问边界。</p><span><Activity size={15} />所有写操作都会进入管理审计</span></section></div></section>;
}

function valueLength(result) { return result.status === "fulfilled" ? (result.value?.items || result.value || []).length : 0; }
