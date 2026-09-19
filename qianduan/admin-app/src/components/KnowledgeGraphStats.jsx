import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

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
      {["学段分布", "主题类别 Top", "关系类型", "章节 COVERS"].map((title) => (
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
  const edgeData = useMemo(() => countBy(edges, (e) => e.relation), [edges]);

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
    color: ["#1796d2", "#0f766e", "#b54708", "#6941c6"],
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
    color: ["#1796d2"],
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
      itemStyle: { borderRadius: [0, 4, 4, 0], color: "#1796d2" },
    }],
  }, !loading);

  const edgeRef = useChart({
    color: ["#1796d2", "#98a2b3", "#0f766e"],
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      radius: ["40%", "66%"],
      data: edgeData.length ? edgeData : [{ name: "暂无边", value: 1 }],
      label: { fontSize: 11, color: "#667085" },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
    }],
  }, !loading);

  const coverRef = useChart({
    color: ["#12b76a", "#e4e7ec"],
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
        <header><strong>学段分布</strong><small>{points.length} 个节点</small></header>
        <div ref={stageRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header><strong>主题类别 Top</strong><small>不含大类节点</small></header>
        <div ref={categoryRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header><strong>关系类型</strong><small>{edges.length} 条边</small></header>
        <div ref={edgeRef} className="kg-stat-chart" />
      </article>
      <article className="kg-stat-card">
        <header>
          <strong>章节 COVERS</strong>
          <small>
            覆盖知识点 {coverStats.coveredPoints}/{coverStats.totalPoints || 0}
            · 讲解边 {coverStats.explainsCount}
          </small>
        </header>
        <div ref={coverRef} className="kg-stat-chart" />
      </article>
    </section>
  );
}
