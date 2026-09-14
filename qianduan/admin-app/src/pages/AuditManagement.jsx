import { RefreshCw, ScrollText, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { auditsApi } from "../api/client.js";

export function AuditManagement({ notify }) {
  const [tab, setTab] = useState("logins");
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { setData(await auditsApi[tab]()); } catch (error) { notify(error.message, "error"); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [tab]);
  return <section className="page-section"><header className="page-heading"><div><p className="eyebrow">SECURITY AUDIT</p><h1>安全审计</h1><p>查询登录结果和管理员业务操作记录。</p></div><button className="button ghost" type="button" onClick={load}><RefreshCw size={17} />刷新</button></header><div className="audit-tabs"><button className={tab === "logins" ? "active" : ""} type="button" onClick={() => setTab("logins")}><ShieldAlert size={17} />登录审计</button><button className={tab === "operations" ? "active" : ""} type="button" onClick={() => setTab("operations")}><ScrollText size={17} />操作审计</button></div><div className="data-panel"><div className="table-wrap"><table className="responsive-table"><thead><tr>{tab === "logins" ? <><th>用户</th><th>结果</th><th>客户端 IP</th><th>失败原因</th><th>时间</th></> : <><th>操作人</th><th>动作</th><th>目标</th><th>详情</th><th>时间</th></>}</tr></thead><tbody>{loading ? <tr><td colSpan="5" className="empty-cell">正在加载审计记录...</td></tr> : !data.items?.length ? <tr><td colSpan="5" className="empty-cell">暂无审计记录</td></tr> : data.items.map((item) => tab === "logins" ? <tr key={item.id}><td data-label="用户">{item.username}</td><td data-label="结果"><span className={`status ${item.success ? "enabled" : "disabled"}`}>{item.success ? "成功" : "失败"}</span></td><td data-label="客户端 IP">{item.clientIp || "-"}</td><td data-label="失败原因">{item.failureReason || "-"}</td><td data-label="时间">{formatTime(item.createdTime)}</td></tr> : <tr key={item.id}><td data-label="操作人">#{item.operatorUserId}</td><td data-label="动作">{item.action}</td><td data-label="目标">{item.targetType} #{item.targetId}</td><td data-label="详情">{item.detail || "-"}</td><td data-label="时间">{formatTime(item.createdTime)}</td></tr>)}</tbody></table></div></div></section>;
}
function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
