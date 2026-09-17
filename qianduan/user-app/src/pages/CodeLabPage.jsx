import { Braces, Clock3, Code2, Download, FileText, Image, LoaderCircle, Play, RotateCcw, Square, Table2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { agentsApi } from "../api/client.js";

const CODE_EXAMPLES = [
  { id: "average", label: "成绩计算", code: `# 修改代码后点击“运行”
scores = [82, 95, 76, 88]
average = sum(scores) / len(scores)
print(f"平均分：{average:.1f}")` },
  { id: "chart", label: "学习曲线", code: `import matplotlib
matplotlib.use("Agg", force=True)
import matplotlib.pyplot as plt
from io import BytesIO
from IPython.display import Image, display

days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
minutes = [25, 40, 32, 55, 48]
fig, ax = plt.subplots(figsize=(5, 3))
ax.plot(days, minutes, marker="o")
ax.set_ylabel("Minutes")
fig.tight_layout()
buffer = BytesIO()
fig.savefig(buffer, format="png", dpi=100)
display(Image(data=buffer.getvalue()))
plt.close(fig)` },
];

const INITIAL_CODE = CODE_EXAMPLES[0].code;

const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);
const STATUS_LABELS = {
  PENDING: "等待执行",
  RUNNING: "正在执行",
  SUCCEEDED: "执行成功",
  FAILED: "执行失败",
  TIMED_OUT: "执行超时",
  REJECTED: "请求被拒绝",
  CANCELLED: "已取消",
};

export function CodeLabPage({ session, requireLogin }) {
  const [code, setCode] = useState(INITIAL_CODE);
  const [exampleId, setExampleId] = useState(CODE_EXAMPLES[0].id);
  const [mode, setMode] = useState("ASYNC");
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!result?.runId || !ACTIVE_STATUSES.has(result.status)) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const run = await agentsApi.runDetail(result.runId);
        if (!cancelled) setResult(fromRunDetail(run));
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [result]);

  async function execute(event) {
    event.preventDefault();
    if (!session) {
      requireLogin();
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await agentsApi.executeCode({
        code,
        timeoutSeconds: Number(timeoutSeconds),
        executionMode: mode,
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRun() {
    if (!result?.runId) return;
    setError("");
    try {
      const run = await agentsApi.cancel(result.runId);
      setResult(fromRunDetail(run));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function loadExample(nextId) {
    const current = CODE_EXAMPLES.find((example) => example.id === exampleId);
    const next = CODE_EXAMPLES.find((example) => example.id === nextId);
    if (!next) return false;
    if (code !== current?.code && !window.confirm("当前代码将被替换，确定继续吗？")) return false;
    setExampleId(nextId);
    setCode(next.code);
    setResult(null);
    setError("");
    return true;
  }

  const active = submitting || ACTIVE_STATUSES.has(result?.status);

  return (
    <div className="page inner-page code-lab-page">
      <header className="page-title page-title-row">
        <div>
          <p className="eyebrow"><Code2 size={14} />编程实验</p>
          <h1>运行 Python 代码</h1>
          <p>代码只会提交到隔离沙箱，不在浏览器或业务服务进程中执行。</p>
        </div>
        <div className="code-runtime-label"><span />Python 3</div>
      </header>

      {!session && <section className="code-login-notice"><Terminal size={20} /><div><strong>登录后使用编程实验</strong><p>运行记录和生成文件需要关联到你的学习账号。</p></div><button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button></section>}

      <form className="code-workspace" onSubmit={execute}>
        <section className="code-editor-panel">
          <header>
            <div><Code2 size={17} /><strong>main.py</strong></div>
            <div className="code-editor-actions">
              <select aria-label="代码示例" value={exampleId} onChange={(event) => { if (!loadExample(event.target.value)) event.target.value = exampleId; }} disabled={active}>
                {CODE_EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.label}</option>)}
              </select>
              <button className="icon-button" type="button" title="恢复示例代码" onClick={() => loadExample(exampleId)} disabled={active}><RotateCcw size={16} /></button>
            </div>
          </header>
          <div className="code-editor-body">
            <div className="line-numbers" aria-hidden="true">{code.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea aria-label="Python代码" spellCheck="false" value={code} onChange={(event) => setCode(event.target.value)} maxLength={100000} disabled={active} required />
          </div>
          <footer><span>{code.length.toLocaleString("zh-CN")} / 100,000 字符</span><span>暂不支持安装第三方依赖</span></footer>
        </section>

        <aside className="code-control-panel">
          <section>
            <h2>运行设置</h2>
            <label>执行方式<div className="segmented-control code-mode-control"><button className={mode === "ASYNC" ? "active" : ""} type="button" onClick={() => setMode("ASYNC")} disabled={active}>异步</button><button className={mode === "SYNC" ? "active" : ""} type="button" onClick={() => setMode("SYNC")} disabled={active}>同步</button></div></label>
            <label>超时时间<div className="timeout-input"><Clock3 size={16} /><input type="number" min="1" max="30" value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(event.target.value)} disabled={active} /><span>秒</span></div></label>
            <button className="button primary full" type="submit" disabled={!session || active || !code.trim()}>{active ? <LoaderCircle className="spin-icon" size={17} /> : <Play size={17} />}{submitting ? "正在提交" : ACTIVE_STATUSES.has(result?.status) ? STATUS_LABELS[result.status] : "运行代码"}</button>
            {ACTIVE_STATUSES.has(result?.status) && <button className="button secondary full" type="button" onClick={cancelRun}><Square size={15} />取消任务</button>}
          </section>

          <section className="code-result-panel" aria-live="polite">
            <header><div><Terminal size={16} /><h2>运行结果</h2></div>{result?.status && <span className={`run-status status-${result.status.toLowerCase()}`}>{STATUS_LABELS[result.status] || result.status}</span>}</header>
            {error && <p className="page-error" role="alert">{error}</p>}
            {!result && !error && <p className="code-result-empty">运行代码后，标准输出和错误信息会显示在这里。</p>}
            {result && <>
              <pre>{result.stdout || result.stderr || (ACTIVE_STATUSES.has(result.status) ? "任务已提交，正在等待运行结果..." : "程序没有输出。")}</pre>
              <dl><div><dt>运行编号</dt><dd title={result.runId}>{result.runId}</dd></div><div><dt>退出码</dt><dd>{result.exitCode ?? "--"}</dd></div><div><dt>耗时</dt><dd>{result.durationMs == null ? "--" : `${result.durationMs} ms`}</dd></div></dl>
              <CodeArtifacts runId={result.runId} artifacts={result.artifacts} />
            </>}
          </section>
        </aside>
      </form>
    </div>
  );
}

function CodeArtifacts({ runId, artifacts }) {
  if (!Array.isArray(artifacts) || !artifacts.length) return null;

  return <section className="code-artifacts"><h3>生成产物 <span>{artifacts.length}</span></h3>{artifacts.map((artifact) => <ArtifactItem runId={runId} artifact={artifact} key={artifact.artifactId} />)}</section>;
}

function ArtifactItem({ runId, artifact }) {
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const url = safeHttpUrl(artifact.storageUri) || safeHttpUrl(resolvedUrl);
  const stored = typeof artifact.storageUri === "string" && artifact.storageUri.startsWith("s3://");
  const title = artifact.title || artifact.kind || "运行产物";

  async function resolveDownloadUrl() {
    if (!runId || !artifact.artifactId || resolving) return;
    setResolving(true);
    setResolveError("");
    try {
      const response = await agentsApi.artifactDownloadUrl(runId, artifact.artifactId);
      const nextUrl = safeHttpUrl(response?.url);
      if (!nextUrl) throw new Error("服务端未返回有效的临时地址");
      setResolvedUrl(nextUrl);
    } catch (requestError) {
      setResolveError(requestError.message);
    } finally {
      setResolving(false);
    }
  }

  if (artifact.kind === "IMAGE") {
    return <article className="code-artifact"><ArtifactHeading icon={Image} title={title} mimeType={artifact.mimeType} />{url ? <img src={url} alt={title} referrerPolicy="no-referrer" /> : <UnavailableStoredArtifact stored={stored} resolving={resolving} error={resolveError} actionLabel="加载图片" onResolve={resolveDownloadUrl} />}</article>;
  }

  if (artifact.kind === "FILE") {
    return <article className="code-artifact"><ArtifactHeading icon={FileText} title={title} mimeType={artifact.mimeType} />{url ? <a className="artifact-download" href={url} target="_blank" rel="noreferrer"><Download size={15} />下载文件</a> : <UnavailableStoredArtifact stored={stored} resolving={resolving} error={resolveError} actionLabel="生成下载链接" onResolve={resolveDownloadUrl} />}</article>;
  }

  const table = normalizeTable(artifact.payload);
  if (artifact.kind === "TABLE" && table) {
    return <article className="code-artifact"><ArtifactHeading icon={Table2} title={title} mimeType={artifact.mimeType} /><div className="artifact-table-wrap"><table><thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{formatCell(cell)}</td>)}</tr>)}</tbody></table></div></article>;
  }

  if (artifact.kind === "TEXT" && typeof artifact.payload === "string") {
    return <article className="code-artifact"><ArtifactHeading icon={FileText} title={title} mimeType={artifact.mimeType} /><p className="artifact-text">{artifact.payload}</p></article>;
  }

  return <article className="code-artifact"><ArtifactHeading icon={Braces} title={title} mimeType={artifact.mimeType} /><pre className="artifact-json">{formatPayload(artifact.payload)}</pre></article>;
}

function ArtifactHeading({ icon: Icon, title, mimeType }) {
  return <header><Icon size={15} /><div><strong>{title}</strong><small>{mimeType || "未知格式"}</small></div></header>;
}

function UnavailableStoredArtifact({ stored, resolving, error, actionLabel, onResolve }) {
  if (!stored) return <p className="artifact-unavailable">该产物没有可访问的文件地址。</p>;
  return <div className="artifact-access"><p>产物已安全保存，访问时会生成短期有效的下载地址。</p><button className="artifact-download" type="button" disabled={resolving} onClick={onResolve}>{resolving ? <LoaderCircle className="spin-icon" size={15} /> : <Download size={15} />}{resolving ? "正在获取" : actionLabel}</button>{error && <p className="artifact-access-error" role="alert">{error}</p>}</div>;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeTable(payload) {
  if (Array.isArray(payload) && payload.length && payload.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    const columns = Object.keys(payload[0]).slice(0, 12);
    return { columns, rows: payload.slice(0, 100).map((row) => columns.map((column) => row[column])) };
  }
  if (payload && Array.isArray(payload.columns) && Array.isArray(payload.rows)) {
    const columns = payload.columns.slice(0, 12).map(String);
    return { columns, rows: payload.rows.slice(0, 100).map((row) => Array.isArray(row) ? row.slice(0, columns.length) : columns.map((column) => row?.[column])) };
  }
  return null;
}

function formatCell(value) {
  if (value == null) return "--";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function formatPayload(payload) {
  if (payload == null) return "无内嵌数据";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "数据无法显示";
  }
}

function fromRunDetail(run) {
  const metadata = run?.outputMetadata || {};
  return {
    runId: run?.runId,
    status: run?.status,
    stdout: run?.outputText || "",
    stderr: metadata.stderr || run?.errorMessage || "",
    exitCode: metadata.exitCode ?? null,
    durationMs: run?.durationMs ?? metadata.runtimeDurationMs ?? null,
    artifacts: run?.artifacts || [],
  };
}
