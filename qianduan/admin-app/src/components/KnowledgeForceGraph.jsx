import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const CATEGORY_PALETTE = [
  "#1796d2", "#0f766e", "#b54708", "#6941c6", "#dd2590",
  "#027a48", "#3538cd", "#c11574", "#175cd3", "#e04f16",
];

function categoryColor(categoryCode, index) {
  if (!categoryCode) return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
  let hash = 0;
  for (let i = 0; i < categoryCode.length; i += 1) {
    hash = (hash * 31 + categoryCode.charCodeAt(i)) | 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

function collectNeighborhood(seedCodes, edges, hops = 1) {
  const codes = new Set(seedCodes);
  let frontier = new Set(seedCodes);
  for (let hop = 0; hop < hops; hop += 1) {
    const next = new Set();
    edges.forEach((edge) => {
      if (frontier.has(edge.fromCode) && !codes.has(edge.toCode)) {
        codes.add(edge.toCode);
        next.add(edge.toCode);
      }
      if (frontier.has(edge.toCode) && !codes.has(edge.fromCode)) {
        codes.add(edge.fromCode);
        next.add(edge.fromCode);
      }
    });
    frontier = next;
    if (!frontier.size) break;
  }
  return codes;
}

/**
 * Neo4j Browser 风格力导向图：按类别着色、可拖拽、点击聚焦。
 * 默认「聚焦邻居」模式，避免数百节点挤成一团；选中节点始终保留在画布上。
 */
export function KnowledgeForceGraph({
  points = [],
  edges = [],
  selectedCode = "",
  focusMode = "neighborhood",
  categoryFilter = "",
  stageFilter = "",
  onSelect,
  height = 520,
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const graph = useMemo(() => {
    let visible = points.filter((point) => {
      if (stageFilter && point.stage !== stageFilter) return false;
      if (categoryFilter && point.categoryCode !== categoryFilter) return false;
      return true;
    });

    if (focusMode === "neighborhood" && selectedCode) {
      const neighborCodes = collectNeighborhood([selectedCode], edges, 1);
      visible = visible.filter((point) => neighborCodes.has(point.code));
      // 选中点若不在当前筛选结果中，仍强制带上，避免“点了但图上没有”
      if (!visible.some((point) => point.code === selectedCode)) {
        const selected = points.find((point) => point.code === selectedCode);
        if (selected) visible = [selected, ...visible];
      }
    } else if (focusMode === "sample") {
      const byCat = new Map();
      visible.forEach((point) => {
        const key = point.categoryCode || "other";
        if (!byCat.has(key)) byCat.set(key, []);
        const bucket = byCat.get(key);
        if (bucket.length < 8) bucket.push(point);
      });
      const sampled = [...byCat.values()].flat();
      const mustKeep = new Set();
      if (selectedCode) {
        mustKeep.add(selectedCode);
        collectNeighborhood([selectedCode], edges, 1).forEach((code) => mustKeep.add(code));
      }
      const keepPoints = visible.filter((point) => mustKeep.has(point.code));
      const codes = new Set(sampled.map((point) => point.code));
      keepPoints.forEach((point) => {
        if (!codes.has(point.code)) {
          sampled.push(point);
          codes.add(point.code);
        }
      });
      visible = sampled;
    } else if (selectedCode && !visible.some((point) => point.code === selectedCode)) {
      const selected = points.find((point) => point.code === selectedCode);
      if (selected) visible = [selected, ...visible];
    }

    const codes = new Set(visible.map((point) => point.code));
    const categories = [];
    const categoryIndex = new Map();
    visible.forEach((point) => {
      const name = point.categoryTitle || point.categoryCode || "未分类";
      if (!categoryIndex.has(name)) {
        categoryIndex.set(name, categories.length);
        categories.push({ name });
      }
    });

    const nodes = visible.map((point, index) => {
      const catName = point.categoryTitle || point.categoryCode || "未分类";
      const selected = point.code === selectedCode;
      const isCategory = point.kind === "CATEGORY";
      return {
        id: point.code,
        name: point.title || point.code,
        category: categoryIndex.get(catName),
        symbolSize: selected ? 42 : isCategory ? 34 : 22,
        value: point.code,
        cursor: "pointer",
        itemStyle: {
          color: categoryColor(point.categoryCode, index),
          borderColor: selected ? "#0875ad" : "#ffffff",
          borderWidth: selected ? 2 : 1,
          shadowBlur: 0,
        },
        label: {
          show: selected || focusMode === "neighborhood" || visible.length <= 40,
          formatter: point.title || point.code,
          fontSize: selected ? 12 : 10,
          color: "#344054",
        },
        raw: point,
      };
    });

    const links = edges
      .filter((edge) => codes.has(edge.fromCode) && codes.has(edge.toCode))
      .map((edge) => {
        const prereq = edge.relation === "PREREQUISITE_OF";
        const active = selectedCode
          && (edge.fromCode === selectedCode || edge.toCode === selectedCode);
        return {
          source: edge.fromCode,
          target: edge.toCode,
          relation: edge.relation,
          lineStyle: {
            color: active ? "#1796d2" : prereq ? "#9dcfc7" : "#d0d5dd",
            width: active ? 2.2 : prereq ? 1.6 : 1.1,
            type: prereq ? "solid" : "dashed",
            curveness: 0.1,
            opacity: 0.9,
          },
          symbol: prereq ? ["none", "arrow"] : ["none", "none"],
          symbolSize: prereq ? 8 : 0,
        };
      });

    return { nodes, links, categories };
  }, [points, edges, selectedCode, focusMode, categoryFilter, stageFilter]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = echarts.init(hostRef.current);
    chartRef.current = chart;

    const onClick = (params) => {
      if (params.dataType === "edge") return;
      const id = params.data?.id || params.data?.value || params.name;
      const looksLikeNode = params.dataType === "node"
        || (params.seriesType === "graph" && params.data && (params.data.id || params.data.raw));
      if (looksLikeNode && id) onSelectRef.current?.(id);
    };
    chart.on("click", onClick);

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      chart.off("click", onClick);
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter(params) {
          if (params.dataType === "edge" || params.dataType === "link") {
            return `${params.data.source} → ${params.data.target}<br/>${params.data.relation || ""}`;
          }
          const point = params.data?.raw;
          if (!point) return params.name;
          return [
            `<strong>${point.title || point.code}</strong>`,
            point.categoryTitle ? `类别：${point.categoryTitle}` : "",
            point.stage ? `学段：${point.stage}` : "",
            `<span style="opacity:.7">${point.code}</span>`,
            "<span style=\"opacity:.65\">点击查看详情 / 切换焦点</span>",
          ].filter(Boolean).join("<br/>");
        },
      },
      legend: graph.categories.length > 1
        ? [{
          data: graph.categories.map((item) => item.name),
          type: "scroll",
          bottom: 0,
          textStyle: { fontSize: 11 },
          selectedMode: true,
        }]
        : undefined,
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          categories: graph.categories,
          data: graph.nodes,
          links: graph.links,
          label: { position: "bottom" },
          force: {
            repulsion: focusMode === "neighborhood" ? 280 : 160,
            edgeLength: focusMode === "neighborhood" ? [60, 140] : [40, 100],
            gravity: 0.06,
            friction: 0.22,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 3 },
            scale: true,
          },
          scaleLimit: { min: 0.35, max: 3 },
        },
      ],
    }, { notMerge: true });
  }, [graph, focusMode]);

  return (
    <div className="kg-force-wrap">
      <div ref={hostRef} className="kg-force-chart" style={{ height }} role="img" aria-label="知识图谱力导向图" />
      {!graph.nodes.length && <p className="manager-empty kg-force-empty">当前筛选下没有可展示的节点</p>}
    </div>
  );
}
