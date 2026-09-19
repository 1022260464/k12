import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  GitBranch,
  Network,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { knowledgeGraphApi } from "../api/client.js";
import { KnowledgeForceGraph } from "../components/KnowledgeForceGraph.jsx";
import { KnowledgeGraphStats } from "../components/KnowledgeGraphStats.jsx";

const LOOP_STEPS = [
  {
    key: "ask",
    title: "提问讲解",
    desc: "学生提问 → 教学助教结合掌握度与图谱上下文作答",
    ready: (loop) => loop?.graphReady && loop?.hasKnowledgePoints,
  },
  {
    key: "rag",
    title: "RAG 引用",
    desc: "资料入库：向量检索 + EXPLAINS；简介写入图谱 description",
    ready: (loop) => loop?.hasExplains,
  },
  {
    key: "mastery",
    title: "小测掌握度",
    desc: "练习结果写回 knowledge_code 掌握度（Assessment）",
    ready: (loop) => loop?.hasKnowledgePoints,
  },
  {
    key: "nav",
    title: "先修 / 下一主题",
    desc: "按 PREREQUISITE_OF 提示薄弱先修与可学主题",
    ready: (loop) => loop?.hasPrerequisiteEdges,
  },
  {
    key: "covers",
    title: "章节覆盖",
    desc: "章节导语 + COVERS 绑定，形成课程→知识点入口",
    ready: (loop) => loop?.hasChapterCovers,
  },
];

const STAGE_OPTIONS = [
  { value: "", label: "全部学段" },
  { value: "小学低年级", label: "小学低年级" },
  { value: "小学高年级", label: "小学高年级" },
  { value: "初中", label: "初中" },
  { value: "高中", label: "高中" },
];

export function KnowledgeGraphPage({ isAdmin, notify }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState("");
  const [neighbors, setNeighbors] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [focusMode, setFocusMode] = useState("neighborhood");
  const [stageFilter, setStageFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [nodeQuery, setNodeQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await knowledgeGraphApi.overview();
      setOverview(data);
      if (!selectedCode && data.points?.length) {
        const firstTopic = data.points.find((point) => point.kind !== "CATEGORY") || data.points[0];
        setSelectedCode(firstTopic.code);
      }
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedCode) {
      setNeighbors([]);
      return;
    }
    knowledgeGraphApi.neighbors(selectedCode)
      .then((rows) => setNeighbors(Array.isArray(rows) ? rows : []))
      .catch(() => setNeighbors([]));
  }, [selectedCode]);

  async function seed() {
    setSeeding(true);
    try {
      await knowledgeGraphApi.seed();
      notify("种子图已写入 Neo4j");
      await load();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSeeding(false);
    }
  }

  const loop = overview?.teachingLoop;
  const points = overview?.points || [];
  const edges = overview?.edges || [];
  const selected = points.find((point) => point.code === selectedCode);
  const chapterHits = (overview?.chapterCovers || []).filter((chapter) =>
    (chapter.knowledgeCodes || []).includes(selectedCode));

  const categories = useMemo(() => {
    const map = new Map();
    points.forEach((point) => {
      if (!point.categoryCode) return;
      map.set(point.categoryCode, point.categoryTitle || point.categoryCode);
    });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [points]);

  const selectablePoints = useMemo(() => {
    const q = nodeQuery.trim().toLowerCase();
    return points
      .filter((point) => point.kind !== "CATEGORY")
      .filter((point) => {
        if (stageFilter && point.stage !== stageFilter) return false;
        if (categoryFilter && point.categoryCode !== categoryFilter) return false;
        if (!q) return true;
        return [point.title, point.code, point.categoryTitle]
          .filter(Boolean)
          .some((text) => String(text).toLowerCase().includes(q));
      })
      .slice(0, 80);
  }, [points, nodeQuery, stageFilter, categoryFilter]);

  function jumpToNode(code) {
    if (!code) return;
    setSelectedCode(code);
  }

  return (
    <section className="page-section kg-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">KNOWLEDGE GRAPH</p>
          <h1>知识图谱与教学闭环</h1>
          <p>
            {isAdmin
              ? "管理员可查看全库 Neo4j 关系、覆盖率统计，并初始化种子图。"
              : "教师可查看知识点关系、章节 COVERS 覆盖与教学闭环进度。"}
          </p>
        </div>
        <div className="kg-heading-actions">
          <button className="button ghost" type="button" onClick={load} disabled={loading}>
            <RefreshCw size={16} />{loading ? "加载中..." : "刷新"}
          </button>
          {isAdmin && (
            <button className="button primary" type="button" onClick={seed} disabled={seeding}>
              <Sparkles size={16} />{seeding ? "写入中..." : "初始化种子图"}
            </button>
          )}
        </div>
      </header>

      <div className={`kg-status-banner${overview?.status?.ready ? " is-ready" : ""}`}>
        <Network size={18} />
        <div>
          <strong>
            {loading
              ? "图谱加载中…"
              : overview?.status?.enabled
                ? (overview.status.ready ? "图谱已连通" : "图谱未就绪")
                : "图谱未启用（预览内置种子）"}
          </strong>
          <p>{loop?.summary || (loading ? "正在从 Neo4j 读取节点与关系…" : "暂无状态")}</p>
        </div>
        <span className="kg-stat">点 {loading ? "…" : points.length}</span>
        <span className="kg-stat">边 {loading ? "…" : edges.length}</span>
        <span className="kg-stat">章节 {loading ? "…" : (overview?.chapterCovers?.length || 0)}</span>
        <span className="kg-stat">讲解 {loading ? "…" : (overview?.explainsCount || 0)}</span>
      </div>

      <KnowledgeGraphStats
        loading={loading}
        points={points}
        edges={edges}
        chapterCovers={overview?.chapterCovers || []}
        explainsCount={overview?.explainsCount || 0}
      />

      <section className="kg-loop-panel">
        <header>
          <GitBranch size={18} />
          <div>
            <strong>教学闭环</strong>
            <small>绿勾表示该环节已有图谱侧数据支撑</small>
          </div>
        </header>
        <ol className="kg-loop-steps">
          {LOOP_STEPS.map((step, index) => {
            const ok = step.ready(loop);
            return (
              <li key={step.key} className={ok ? "is-ready" : ""}>
                <span className="kg-loop-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.desc}</p>
                </div>
                {ok ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="kg-main-grid">
        <section className="kg-card kg-graph-card">
          <header className="kg-graph-header">
            <div>
              <strong>知识点关系图</strong>
              <small>
                点击节点或右侧列表切换焦点；默认只显示选中点的邻居。要找远处节点请用搜索，或切换到「分类抽样 / 全量」。
              </small>
            </div>
            <div className="kg-graph-toolbar">
              <label className="kg-node-search">
                查找节点
                <input
                  type="search"
                  value={nodeQuery}
                  placeholder="标题或编码"
                  onChange={(event) => setNodeQuery(event.target.value)}
                />
              </label>
              <label>
                视图
                <select value={focusMode} onChange={(event) => setFocusMode(event.target.value)}>
                  <option value="neighborhood">聚焦邻居（推荐）</option>
                  <option value="sample">分类抽样概览</option>
                  <option value="all">当前筛选全量</option>
                </select>
              </label>
              <label>
                学段
                <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                类别
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">全部类别</option>
                  {categories.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </header>
          {loading ? (
            <p className="manager-empty">正在绘制图谱…</p>
          ) : (
            <KnowledgeForceGraph
              points={points}
              edges={edges}
              selectedCode={selectedCode}
              focusMode={focusMode}
              stageFilter={stageFilter}
              categoryFilter={categoryFilter}
              onSelect={jumpToNode}
            />
          )}
          <div className="kg-legend">
            <span><i className="kg-legend-prereq" />先修 PREREQUISITE_OF</span>
            <span><i className="kg-legend-related" />相关 RELATED_TO</span>
            <span>滚轮缩放 · 拖拽画布 · 点击节点切换焦点</span>
          </div>
        </section>

        <aside className="kg-card kg-detail-card">
          <header>
            <Target size={16} />
            <strong>节点详情</strong>
          </header>

          <label className="kg-picker-label">
            快速定位
            <select
              value={selectedCode}
              onChange={(event) => jumpToNode(event.target.value)}
              aria-label="选择知识点"
            >
              <option value="">选择知识点…</option>
              {selectablePoints.map((point) => (
                <option key={point.code} value={point.code}>
                  {point.title || point.code}
                  {point.categoryTitle ? ` · ${point.categoryTitle}` : ""}
                </option>
              ))}
            </select>
          </label>

          {nodeQuery.trim() && (
            <ul className="kg-search-hits">
              {selectablePoints.length ? selectablePoints.slice(0, 12).map((point) => (
                <li key={point.code}>
                  <button
                    type="button"
                    className={point.code === selectedCode ? "is-active" : ""}
                    onClick={() => jumpToNode(point.code)}
                  >
                    <strong>{point.title || point.code}</strong>
                    <small>{point.categoryTitle || point.stage || point.code}</small>
                  </button>
                </li>
              )) : (
                <li className="binding-empty">没有匹配的知识点</li>
              )}
            </ul>
          )}

          {selected ? (
            <>
              <h3>{selected.title}</h3>
              <p className="kg-code">{selected.code}</p>
              <p className="kg-meta">
                {selected.categoryTitle || "未分类"}
                {" · "}学段 {selected.stage || "-"}
                {" · "}难度 {selected.difficulty ?? "-"}
                {" · "}{selected.kind || "TOPIC"}
              </p>
              <h4>相邻关系（点击可跳转）</h4>
              {neighbors.length ? (
                <ul className="kg-neighbor-list">
                  {neighbors.map((row) => (
                    <li key={`${row.relation}-${row.direction}-${row.code}`}>
                      <button type="button" onClick={() => jumpToNode(row.code)}>
                        <strong>{row.title || row.code}</strong>
                        <small>{row.relation} · {row.direction === "OUT" ? "指出" : "指入"}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="binding-empty">暂无邻居。可改用「分类抽样」或搜索其他节点。</p>
              )}
              <h4>覆盖本章的课程章节</h4>
              {chapterHits.length ? (
                <ul className="kg-chapter-list">
                  {chapterHits.map((chapter) => (
                    <li key={`${chapter.courseId}-${chapter.chapterId}`}>
                      <BookOpen size={14} />
                      <div>
                        <strong>{chapter.title || `章节 ${chapter.chapterId}`}</strong>
                        <small>课程 #{chapter.courseId} · 章节 #{chapter.chapterId}</small>
                        {chapter.description ? <p>{chapter.description}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="binding-empty">尚未有章节 COVERS 绑定此知识点</p>
              )}
            </>
          ) : (
            <p className="binding-empty">请在图上点击节点，或用上方搜索 / 下拉框选择</p>
          )}
        </aside>
      </div>

      <section className="kg-card">
        <header>
          <strong>已绑定章节（COVERS）</strong>
          <small>来自 CourseChapterRef，导语即 description</small>
        </header>
        {(overview?.chapterCovers || []).length ? (
          <div className="kg-chapter-table">
            {(overview.chapterCovers || []).map((chapter) => (
              <article key={`${chapter.courseId}-${chapter.chapterId}`}>
                <strong>{chapter.title || `章节 ${chapter.chapterId}`}</strong>
                <small>课程 #{chapter.courseId} · 章节 #{chapter.chapterId}</small>
                <p>{chapter.description || "（无导语描述）"}</p>
                <div className="kg-code-chips">
                  {(chapter.knowledgeCodes || []).map((code) => {
                    const title = points.find((point) => point.code === code)?.title || code;
                    return (
                      <button key={code} type="button" className="kg-chip" onClick={() => jumpToNode(code)}>
                        {title}
                      </button>
                    );
                  })}
                  {!chapter.knowledgeCodes?.length && <span className="binding-empty">未绑定知识点</span>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="manager-empty">暂无章节绑定。请在课程工作台填写导语并保存知识点绑定。</p>
        )}
      </section>
    </section>
  );
}
