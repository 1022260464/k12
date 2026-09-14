import { Ban, Box, Eye, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi } from "../api/client.js";
import { Modal } from "../components/Modal.jsx";

export function AgentRunManager({ notify, onClose }) {
  const [runs, setRuns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const page = await agentsApi.runs(1, 50); setRuns(page?.items || []); }
    catch (error) { notify(error.message, "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function inspect(runId) {
    try {
      const run = await agentsApi.runDetail(runId);
      const artifacts = await agentsApi.artifacts(runId);
      setDetail({ ...run, artifacts: artifacts || run.artifacts || [] });
    } catch (error) { notify(error.message, "error"); }
  }

  async function action(run, name) {
    try { await agentsApi[name](run.runId); notify(name === "cancel" ? "运行已取消" : "运行已重新提交"); setDetail(null); await load(); }
    catch (error) { notify(error.message, "error"); }
  }

  return <Modal title="智能体运行中心" description="查看运行状态、输入输出与生成产物，并处理失败或长时间运行的任务。" onClose={onClose} width={1080}>
    <div className="run-manager">
      <div className="manager-table-head"><strong>最近运行</strong><button className="icon-button" type="button" title="刷新运行记录" onClick={load}><RefreshCw size={17} /></button></div>
      <div className="table-wrap"><table className="responsive-table"><thead><tr><th>运行 ID</th><th>智能体</th><th>模式</th><th>状态</th><th>耗时</th><th>创建时间</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="empty-cell">正在加载运行记录...</td></tr> : runs.length === 0 ? <tr><td colSpan="7" className="empty-cell">暂无运行记录</td></tr> : runs.map((run) => <tr key={run.runId}><td data-label="运行 ID"><code>{shortId(run.runId)}</code></td><td data-label="智能体">{run.agentCode}</td><td data-label="模式">{run.executionMode}</td><td data-label="状态"><span className={`status ${statusClass(run.status)}`}>{run.status}</span></td><td data-label="耗时">{run.durationMs == null ? "-" : `${run.durationMs} ms`}</td><td data-label="创建时间">{formatTime(run.createdTime)}</td><td data-label="操作"><div className="row-actions"><button className="icon-button" type="button" title="查看详情" onClick={() => inspect(run.runId)}><Eye size={16} /></button>{["PENDING", "RUNNING"].includes(run.status) && <button className="icon-button danger" type="button" title="取消运行" onClick={() => action(run, "cancel")}><Ban size={16} /></button>}{["FAILED", "TIMED_OUT", "CANCELLED"].includes(run.status) && <button className="icon-button" type="button" title="重新运行" onClick={() => action(run, "retry")}><RotateCcw size={16} /></button>}</div></td></tr>)}</tbody></table></div>
      {detail && <section className="run-detail"><header><div><strong>{detail.agentCode}</strong><code>{detail.runId}</code></div><button className="button ghost compact" type="button" onClick={() => setDetail(null)}>关闭详情</button></header><div className="run-detail-grid"><article><small>输入</small><p>{detail.inputText || "-"}</p></article><article><small>输出</small><p>{detail.outputText || detail.errorMessage || "尚无输出"}</p></article></div><h3><Box size={16} />产物 {detail.artifacts?.length || 0}</h3>{detail.artifacts?.length ? <div className="artifact-list">{detail.artifacts.map((artifact) => <article key={artifact.artifactId}><strong>{artifact.title || artifact.kind}</strong><small>{artifact.mimeType} · {artifact.storageUri || "内嵌数据"}</small><pre>{artifact.payload ? JSON.stringify(artifact.payload, null, 2) : "无内嵌内容"}</pre></article>)}</div> : <p className="manager-empty">本次运行没有产物。</p>}</section>}
    </div>
  </Modal>;
}

function statusClass(status) { return status === "SUCCEEDED" ? "enabled" : ["FAILED", "TIMED_OUT"].includes(status) ? "disabled" : "pending"; }
function shortId(value) { return value ? `${value.slice(0, 8)}...` : "-"; }
function formatTime(value) { return value ? new Date(value).toLocaleString("zh-CN") : "-"; }
