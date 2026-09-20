import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

/** 上方统计图固定浅色，不支持自定义 */
const STATS_LIGHT_COLORS = ["#b9dff2", "#b7e0d4", "#f5d4b0", "#d7c6ef", "#f2c4da", "#c5e0b8"];
const STATS_BAR_COLOR = "#b9dff2";
const STATS_COVER_COLORS = ["#b7e0d4", "#e8eef2"];

function useChart(option, enabled = true) {
  const hostRef = useRef(null);
  useEffect(() => {
    if (!enabled || !hostRef.current) return undefined;
    const chart = echarts.init(hostRef.current);
    chart.setOption(option, { notMerge: true });
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option, enabled]);
  return hostRef;
}

function countBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item) || "未标注";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function StatsLoadingSkeleton() {
  return (
    <section className="kg-stats-grid">
      {["学段分布", "主题类别 Top", "关系类型", "章节绑定"].map((title) => (
        <article className="kg-stat-card" key={title}>
          <header><strong>{title}</strong><small>加载中</small></header>
          <div className="kg-stat-loading">图表加载中…</div>
        </article>
      ))}
    </section>
  );
}

/** 图谱侧统计：学段、类别、边类型、章节覆盖。 */
export function KnowledgeGraphStats({
  points = [],
  edges = [],
  chapterCovers = [],
  explainsCount = 0,
  loading = false,
}) {
  const stageData = useMemo(() => countBy(points, (p) => p.stage), [points]);
  const categoryData = useMemo(
    () => countBy(points.filter((p) => p.kind !== "CATEGORY"), (p) => p.categoryTitle || p.categoryCode),
    [points],
  );
  const edgeData = useMemo(() => countBy(edges, (e) => {
    const key = String(e.relation || "").toUpperCase();
    if (key === "PREREQUISITE_OF") return "先修";
    if (key === "RELATED_TO") return "相关拓展";
    if (key === "HAS_CHILD") return "同属一类";
    if (key === "COVERS") return "章节覆盖";
    if (key === "EXPLAINS") return "资料讲解";
    return e.relation || "其他";
  }), [edges]);

  const coverStats = useMemo(() => {
    const bound = chapterCovers.filter((ch) => (ch.knowledgeCodes || []).length > 0).length;
    const empty = Math.max(chapterCovers.length - bound, 0);
    const codeHits = new Set();
    chapterCovers.forEach((ch) => (ch.knowledgeCodes || []).forEach((code) => codeHits.add(code)));
    return {
      bound,
      empty,
      coveredPoints: codeHits.size,
      totalPoints: points.filter((p) => p.kind !== "CATEGORY").length,
      chapters: chapterCovers.length,
      explainsCount,
    };
  }, [chapterCovers, points, explainsCount]);

  const stageRef = useChart({
    color: STATS_LIGHT_COLORS,
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      center: ["50%", "52%"],
      data: stageData,
      label: { fontSize: 11, color: "#667085" },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
    }],
  }, !loading);

  const categoryRef = useChart({
    color: [STATS_BAR_COLOR],
    grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", splitLine: { lineStyle: { color: "#eef2f6" } }, axisLabel: { color: "#98a2b3" } },
    yAxis: {
      type: "category",
      data: categoryData.slice(0, 8).map((item) => item.name).reverse(),
      axisLabel: { width: 88, overflow: "truncate", fontSize: 11, color: "#475467" },
      axisLine: { lineStyle: { color: "#e4e7ec" } },
    },
    series: [{
      type: "bar",
      data: categoryData.slice(0, 8).map((item) => item.value).reverse(),
      barWidth: 12,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: STATS_BAR_COLOR },
    }],
  }, !loading);

  const edgeRef = useChart({
    color: STATS_LIGHT_COLORS,
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      radius: ["40%", "66%"],
      data: edgeData.length ? edgeData : [{ name: "暂无关系", value: 1 }],
      label: { fontSize: 11, color: "#667085" },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
    }],
  }, !loading);

  const coverRef = useChart({
    color: STATS_COVER_COLORS,
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      radius: ["42%", "68%"],
      data: coverStats.chapters
        ? [
          { name: "已绑定知识点", value: coverStats.bound },
          { name: "未绑定", value: coverStats.empty },
        ]
        : [{ name: "暂无章节", value: 1 }],
      label: { fontSize: 11, color: "#667085" },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
    }],
  }, !loading);

  if (loading) return <StatsLoadingSkeleton />;

  return (
    <section className="kg-stats-grid">
      <article className="kg-stat-card">
        <header><strong>学段分布</strong><small>{points.length} 个主题节点</small></header>
        <div ref={stageRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header><strong>主题类别</strong><small>不含大类汇总</small></header>
        <div ref={categoryRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header><strong>关系类型</strong><small>{edges.length} 条关联</small></header>
        <div ref={edgeRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header>
          <strong>章节绑定</strong>
          <small>
            已覆盖主题 {coverStats.coveredPoints}/{coverStats.totalPoints || 0}
            · 讲解资料 {coverStats.explainsCount}
          </small>
        </header>
        <div ref={coverRef} className="kg-stat-chart" />
      </article>
    </section>
  );
}
