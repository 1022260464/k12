import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Clock3,
  Code2,
  Download,
  FileText,
  Image,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Table2,
  Terminal,
  XCircle,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { agentsApi } from "../api/client.js";
import { CodeCoachPanel } from "../components/CodeCoachPanel.jsx";
import { Modal } from "../components/Modal.jsx";
import { parsePythonDiagnostics } from "../utils/pythonDiagnostics.js";

const PythonCodeEditor = lazy(() => import("../components/PythonCodeEditor.jsx"));

const CODE_EXAMPLES = [
  { id: "average", label: "成绩计算", code: `# 修改代码后点击“运行”
scores = [82, 95, 76, 88]
average = sum(scores) / len(scores)
print(f"平均分：{average:.1f}")` },
  { id: "bubble-sort", label: "冒泡排序", code: `# 冒泡排序：相邻比较，较大值逐步“冒”到右侧
values = [5, 2, 4, 1]
print("开始:", values)
n = len(values)
for pass_no in range(1, n):
    swapped = False
    for i in range(0, n - pass_no):
        left, right = values[i], values[i + 1]
        print(f"第{pass_no}轮 比较 {left} 与 {right}")
        if left > right:
            values[i], values[i + 1] = right, left
            swapped = True
            print("  交换后:", values)
    if not swapped:
        print("本轮无交换，提前结束")
        break
print("结果:", values)` },
  { id: "selection-sort", label: "选择排序", code: `# 选择排序：每轮在未排序区间找最小值，再放到左侧
values = [5, 2, 4, 1]
print("开始:", values)
n = len(values)
for start in range(n - 1):
    min_index = start
    for i in range(start + 1, n):
        print(f"第{start + 1}轮 当前最小候选 {values[min_index]}，比较 {values[i]}")
        if values[i] < values[min_index]:
            min_index = i
    if min_index != start:
        values[start], values[min_index] = values[min_index], values[start]
        print("  交换后:", values)
    else:
        print("  本轮起点已是最小，无需交换")
print("结果:", values)` },
  { id: "insertion-sort", label: "插入排序", code: `# 插入排序：把新元素插入左侧已排序区间
values = [5, 2, 4, 1]
print("开始:", values)
for i in range(1, len(values)):
    j = i
    print(f"插入位置候选 {values[j]}")
    while j > 0 and values[j - 1] > values[j]:
        print(f"  比较 {values[j - 1]} 与 {values[j]}，交换")
        values[j - 1], values[j] = values[j], values[j - 1]
        j -= 1
        print("  当前:", values)
print("结果:", values)` },
  { id: "linear-search", label: "线性查找", code: `# 线性查找：从左到右依次探测
values = [5, 2, 4, 1, 8, 3]
target = 8
print("查找目标:", target)
found_at = None
for index, value in enumerate(values):
    print(f"探测下标 {index}，值 {value}")
    if value == target:
        found_at = index
        break
print("结果:", found_at if found_at is not None else "未找到")` },
  { id: "binary-search", label: "二分查找", code: `# 二分查找：有序数组上每次丢掉一半
values = [1, 2, 4, 5, 7, 9]
target = 5
low, high = 0, len(values) - 1
print("有序数组:", values, "目标:", target)
found_at = None
while low <= high:
    mid = (low + high) // 2
    print(f"区间[{low},{high}] 中点 {mid} 值 {values[mid]}")
    if values[mid] == target:
        found_at = mid
        break
    if target < values[mid]:
        high = mid - 1
    else:
        low = mid + 1
print("结果:", found_at if found_at is not None else "未找到")` },
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
  PENDING: "准备中",
  RUNNING: "正在运行",
  SUCCEEDED: "运行成功",
  FAILED: "运行失败",
  TIMED_OUT: "运行超时",
  REJECTED: "暂时无法运行",
  CANCELLED: "已停止",
};

const CODE_LAB_DOODLE = "/assets/code-lab-laptop-doodle.png";

export function CodeLabPage({ session, requireLogin }) {
  const [code, setCode] = useState(INITIAL_CODE);
  const [exampleId, setExampleId] = useState(CODE_EXAMPLES[0].id);
  const [mode, setMode] = useState("ASYNC");
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachIntent, setCoachIntent] = useState("guide");

  useEffect(() => {
    function applyPreferredExample(exampleId) {
      const preferred = exampleId || sessionStorage.getItem("k12-codelab-example");
      if (!preferred) return;
      sessionStorage.removeItem("k12-codelab-example");
      const next = CODE_EXAMPLES.find((example) => example.id === preferred);
      if (!next) return;
      setExampleId(next.id);
      setCode(next.code);
      setResult(null);
      setError("");
      setResultOpen(false);
    }

    applyPreferredExample();
    function onOpenCodeLab(event) {
      applyPreferredExample(event?.detail?.exampleId);
    }
    window.addEventListener("k12-open-codelab", onOpenCodeLab);
    return () => window.removeEventListener("k12-open-codelab", onOpenCodeLab);
  }, []);

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
    setResultOpen(true);
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
    setResultOpen(false);
    return true;
  }

  const active = submitting || ACTIVE_STATUSES.has(result?.status);
  const runDiagnostics = useMemo(
    () => parsePythonDiagnostics(result?.stderr || error || ""),
    [result?.stderr, error],
  );
  const exampleLabel = CODE_EXAMPLES.find((item) => item.id === exampleId)?.label || "";
  // 必须先有过运行结果且存在报错/失败态，才允许「帮我看报错」
  const hasRunError = useMemo(() => {
    if (!result && !error) return false;
    const stderr = String(result?.stderr || "").trim();
    const requestError = String(error || "").trim();
    if (stderr || requestError) return true;
    return ["FAILED", "TIMED_OUT", "REJECTED"].includes(result?.status);
  }, [result, error]);

  function openCoach(intent = "guide") {
    if (intent === "debug" && !hasRunError) return;
    requireLogin(() => {
      setCoachIntent(intent);
      setCoachOpen(true);
    });
  }

  return (
    <div className="page inner-page code-lab-page">
      <header className="page-title page-title-row">
        <div className="page-title-copy">
          <p className="eyebrow"><Code2 size={14} /> 编程实验</p>
          <h1 className="page-title-with-doodle">
            <span>运行 Python 代码</span>
            <img className="page-title-doodle page-title-doodle-laptop" src={CODE_LAB_DOODLE} alt="" width={110} height={90} />
          </h1>
          <p>支持语法高亮与补全；可在本页直接获得写码与改错指导。</p>
        </div>
        <div className="code-runtime-label"><span />Python 3</div>
      </header>

      {!session && (
        <section className="code-login-notice">
          <Terminal size={20} />
          <div>
            <strong>登录后使用编程实验</strong>
            <p>登录后才能保存运行结果和生成的文件。</p>
          </div>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      )}

      <form className="code-workspace code-workspace-compact" onSubmit={execute}>
        <section className="code-editor-panel">
          <header>
            <div><Code2 size={17} /><strong>我的代码</strong></div>
            <div className="code-editor-actions">
              <select
                aria-label="代码示例"
                value={exampleId}
                onChange={(event) => {
                  if (!loadExample(event.target.value)) event.target.value = exampleId;
                }}
                disabled={active}
              >
                {CODE_EXAMPLES.map((example) => (
                  <option key={example.id} value={example.id}>{example.label}</option>
                ))}
              </select>
              <button className="icon-button" type="button" title="恢复示例代码" onClick={() => loadExample(exampleId)} disabled={active}>
                <RotateCcw size={16} />
              </button>
            </div>
          </header>
          <div className="code-editor-body code-editor-body-monaco">
            <Suspense fallback={<div className="python-monaco-loading">正在加载编辑器…</div>}>
              <PythonCodeEditor
                value={code}
                onChange={setCode}
                diagnostics={runDiagnostics}
                readOnly={active}
              />
            </Suspense>
          </div>
          <footer>
            <span>{code.length.toLocaleString("zh-CN")} / 100,000 字符 · Ctrl/⌘+Enter 运行</span>
            <span>暂不支持安装额外扩展包</span>
          </footer>
        </section>

        <aside className="code-control-panel">
          <section>
            <h2>运行选项</h2>
            <label>
              运行方式
              <div className="segmented-control code-mode-control">
                <button className={mode === "ASYNC" ? "active" : ""} type="button" onClick={() => setMode("ASYNC")} disabled={active} title="提交后可先做其他事，稍后再看结果">后台运行</button>
                <button className={mode === "SYNC" ? "active" : ""} type="button" onClick={() => setMode("SYNC")} disabled={active} title="等待运行完成后再显示结果">等待结果</button>
              </div>
            </label>
            <label>
              最长等待
              <div className="timeout-input">
                <Clock3 size={16} />
                <input type="number" min="1" max="30" value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(event.target.value)} disabled={active} />
                <span>秒</span>
              </div>
            </label>
            <button className="button primary full" type="submit" disabled={!session || active || !code.trim()}>
              {active ? <LoaderCircle className="spin-icon" size={17} /> : <Play size={17} />}
              {submitting ? "正在运行" : ACTIVE_STATUSES.has(result?.status) ? STATUS_LABELS[result.status] : "运行代码"}
            </button>
            {ACTIVE_STATUSES.has(result?.status) && (
              <button className="button secondary full" type="button" onClick={cancelRun}>
                <Square size={15} />停止运行
              </button>
            )}
            {(result || error) && (
              <button className="button ghost full" type="button" onClick={() => setResultOpen(true)}>
                <Terminal size={15} />
                查看运行结果
              </button>
            )}
            {result?.status && (
              <div className={`code-result-chip status-${result.status.toLowerCase()}`}>
                <span>{STATUS_LABELS[result.status] || "状态更新中"}</span>
                <small>{formatDuration(result.durationMs)}</small>
              </div>
            )}
          </section>

          <section className="code-ai-assist">
            <h2><Sparkles size={16} /> 代码教练</h2>
            <p>在本页右侧打开对话，帮你审查代码、理解报错并给出修改建议。</p>
            <button className="button primary full" type="button" onClick={() => openCoach("guide")} disabled={active}>
              <Sparkles size={16} />打开代码教练
            </button>
            <button
              className="button secondary full"
              type="button"
              onClick={() => openCoach("debug")}
              disabled={active || !hasRunError}
              title={hasRunError ? "根据最近一次运行报错进行分析" : "请先运行代码并产生报错后再使用"}
            >
              <Terminal size={15} />帮我看报错
            </button>
            <button className="button ghost full" type="button" onClick={() => openCoach("explain")} disabled={active}>
              <Sparkles size={15} />解释这段代码
            </button>
          </section>
        </aside>
      </form>

      <CodeCoachPanel
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        session={session}
        requireLogin={requireLogin}
        code={code}
        result={result}
        error={error}
        exampleLabel={exampleLabel}
        initialIntent={coachIntent}
        hasRunError={hasRunError}
      />

      {resultOpen && (
        <Modal
          title="运行结果"
          description={result?.status ? (STATUS_LABELS[result.status] || "结果准备中") : "等待运行结果"}
          onClose={() => setResultOpen(false)}
          width={760}
          layer={120}
        >
          <div className="code-result-modal" aria-live="polite">
            <header className="code-result-modal-head">
              <RunStatusBadge status={result?.status} submitting={submitting && !result} />
              {ACTIVE_STATUSES.has(result?.status) && (
                <button className="button secondary compact" type="button" onClick={cancelRun}>
                  <Square size={14} />停止
                </button>
              )}
            </header>

            {error && (
              <div className="code-result-alert" role="alert">
                <AlertTriangle size={16} />
                <p>{error}</p>
              </div>
            )}

            {submitting && !result && !error && (
              <div className="code-result-empty-card">
                <LoaderCircle className="spin-icon" size={22} />
                <div>
                  <strong>正在准备运行</strong>
                  <p>请稍候，马上开始运行你的代码。</p>
                </div>
              </div>
            )}

            {!result && !error && !submitting && (
              <div className="code-result-empty-card">
                <Terminal size={22} />
                <div>
                  <strong>暂无运行结果</strong>
                  <p>点击「运行代码」后，输出会显示在这里。</p>
                </div>
              </div>
            )}

            {result && (
              <>
                <div className="code-result-meta">
                  <article>
                    <span><Clock3 size={14} />耗时</span>
                    <strong>{formatDuration(result.durationMs)}</strong>
                  </article>
                  <article>
                    <span><Terminal size={14} />运行状态</span>
                    <strong>{STATUS_LABELS[result.status] || "结果准备中"}</strong>
                  </article>
                  <article>
                    <span><CheckCircle2 size={14} />是否成功</span>
                    <strong>{result.status === "SUCCEEDED" ? "成功" : (ACTIVE_STATUSES.has(result.status) ? "进行中" : "未成功")}</strong>
                  </article>
                </div>

                {(result.stdout || ACTIVE_STATUSES.has(result.status) || (!result.stdout && !result.stderr)) && (
                  <section className={`code-result-stream ${result.stderr && !result.stdout ? "is-muted" : ""}`}>
                    <header>
                      <Terminal size={14} />
                      <strong>程序输出</strong>
                      {result.stdout ? <small>{`${result.stdout.length} 字`}</small> : null}
                    </header>
                    <pre className="code-result-pre is-stdout">
                      {result.stdout
                        || (ACTIVE_STATUSES.has(result.status)
                          ? "代码正在运行，请稍候…"
                          : (result.stderr ? "（本次没有程序输出）" : "程序没有输出。"))}
                    </pre>
                  </section>
                )}

                {Boolean(String(result.stderr || "").trim()) && (
                  <section className="code-result-stream is-error">
                    <header>
                      <XCircle size={14} />
                      <strong>报错信息</strong>
                      <small>可交给代码教练分析</small>
                    </header>
                    <pre className="code-result-pre is-stderr">{result.stderr}</pre>
                  </section>
                )}

                <CodeArtifacts runId={result.runId} artifacts={result.artifacts} />
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function formatDuration(durationMs) {
  if (durationMs == null || Number.isNaN(Number(durationMs))) return "--";
  const ms = Number(durationMs);
  if (ms < 1000) return `${ms} 毫秒`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} 秒`;
}

function friendlyMimeLabel(mimeType, kind) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "图片";
  if (mime.includes("csv") || mime.includes("table") || kind === "TABLE") return "表格";
  if (mime.startsWith("text/") || kind === "TEXT") return "文本";
  if (kind === "IMAGE") return "图片";
  if (kind === "FILE") return "文件";
  return "结果文件";
}

function friendlyArtifactTitle(artifact) {
  if (artifact?.title) return artifact.title;
  return friendlyMimeLabel(artifact?.mimeType, artifact?.kind);
}

function RunStatusBadge({ status, submitting }) {
  if (submitting && !status) {
    return (
      <span className="run-status status-pending">
        <LoaderCircle className="spin-icon" size={13} />准备中
      </span>
    );
  }
  if (!status) {
    return <span className="run-status status-pending"><Terminal size={13} />等待结果</span>;
  }
  const label = STATUS_LABELS[status] || "结果准备中";
  const tone = STATUS_LABELS[status] ? `status-${String(status).toLowerCase()}` : "status-cancelled";
  if (status === "SUCCEEDED") {
    return <span className={`run-status ${tone}`}><CheckCircle2 size={13} />{label}</span>;
  }
  if (status === "FAILED" || status === "TIMED_OUT" || status === "REJECTED") {
    return <span className={`run-status ${tone}`}><XCircle size={13} />{label}</span>;
  }
  if (ACTIVE_STATUSES.has(status)) {
    return <span className={`run-status ${tone}`}><LoaderCircle className="spin-icon" size={13} />{label}</span>;
  }
  return <span className={`run-status ${tone}`}><Terminal size={13} />{label}</span>;
}

function CodeArtifacts({ runId, artifacts }) {
  if (!Array.isArray(artifacts) || !artifacts.length) return null;

  return (
    <section className="code-artifacts">
      <h3>生成结果 <span>{artifacts.length}</span></h3>
      {artifacts.map((artifact) => (
        <ArtifactItem runId={runId} artifact={artifact} key={artifact.artifactId} />
      ))}
    </section>
  );
}

function ArtifactItem({ runId, artifact }) {
  const [resolvedUrl, setResolvedUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const url = safeHttpUrl(artifact.storageUri) || safeHttpUrl(resolvedUrl);
  const stored = typeof artifact.storageUri === "string" && artifact.storageUri.startsWith("s3://");
  const title = friendlyArtifactTitle(artifact);
  const formatLabel = friendlyMimeLabel(artifact.mimeType, artifact.kind);

  async function resolveDownloadUrl() {
    if (!runId || !artifact.artifactId || resolving) return;
    setResolving(true);
    setResolveError("");
    try {
      const response = await agentsApi.artifactDownloadUrl(runId, artifact.artifactId);
      const nextUrl = safeHttpUrl(response?.url);
      if (!nextUrl) throw new Error("暂时无法获取下载地址");
      setResolvedUrl(nextUrl);
    } catch (requestError) {
      setResolveError(requestError.message);
    } finally {
      setResolving(false);
    }
  }

  if (artifact.kind === "IMAGE") {
    return (
      <article className="code-artifact">
        <ArtifactHeading icon={Image} title={title} formatLabel={formatLabel} />
        {url ? (
          <img src={url} alt={title} referrerPolicy="no-referrer" />
        ) : (
          <UnavailableStoredArtifact stored={stored} resolving={resolving} error={resolveError} actionLabel="加载图片" onResolve={resolveDownloadUrl} />
        )}
      </article>
    );
  }

  if (artifact.kind === "FILE") {
    return (
      <article className="code-artifact">
        <ArtifactHeading icon={FileText} title={title} formatLabel={formatLabel} />
        {url ? (
          <a className="artifact-download" href={url} target="_blank" rel="noreferrer"><Download size={15} />下载文件</a>
        ) : (
          <UnavailableStoredArtifact stored={stored} resolving={resolving} error={resolveError} actionLabel="获取下载链接" onResolve={resolveDownloadUrl} />
        )}
      </article>
    );
  }

  const table = normalizeTable(artifact.payload);
  if (artifact.kind === "TABLE" && table) {
    return (
      <article className="code-artifact">
        <ArtifactHeading icon={Table2} title={title} formatLabel={formatLabel} />
        <div className="artifact-table-wrap">
          <table>
            <thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{formatCell(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    );
  }

  if (artifact.kind === "TEXT" && typeof artifact.payload === "string") {
    return (
      <article className="code-artifact">
        <ArtifactHeading icon={FileText} title={title} formatLabel={formatLabel} />
        <p className="artifact-text">{artifact.payload}</p>
      </article>
    );
  }

  return (
    <article className="code-artifact">
      <ArtifactHeading icon={Braces} title={title} formatLabel={formatLabel} />
      <pre className="artifact-json">{formatPayload(artifact.payload)}</pre>
    </article>
  );
}

function ArtifactHeading({ icon: Icon, title, formatLabel }) {
  return (
    <header>
      <Icon size={15} />
      <div>
        <strong>{title}</strong>
        <small>{formatLabel}</small>
      </div>
    </header>
  );
}

function UnavailableStoredArtifact({ stored, resolving, error, actionLabel, onResolve }) {
  if (!stored) return <p className="artifact-unavailable">暂时无法下载这个文件。</p>;
  return (
    <div className="artifact-access">
      <p>文件已保存，点击后可获取短期有效的下载链接。</p>
      <button className="artifact-download" type="button" disabled={resolving} onClick={onResolve}>
        {resolving ? <LoaderCircle className="spin-icon" size={15} /> : <Download size={15} />}
        {resolving ? "正在获取" : actionLabel}
      </button>
      {error && <p className="artifact-access-error" role="alert">{error}</p>}
    </div>
  );
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
  if (payload == null) return "没有可展示的内容";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "内容暂时无法显示";
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
