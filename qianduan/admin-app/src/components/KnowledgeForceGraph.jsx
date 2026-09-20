import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { RotateCcw } from "lucide-react";

echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer]);

const COLOR_STORAGE_KEY = "k12-kg-force-category-colors-v1";

/** 关系图默认浅色 */
export const FORCE_LIGHT_PALETTE = [
  "#b9dff2", "#b7e0d4", "#f5d4b0", "#d7c6ef", "#f2c4da",
  "#c5e0b8", "#c4c9f0", "#efc0d8", "#b8d4f0", "#f0c8b0",
];

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function readStoredCategoryColors() {
  try {
    const raw = localStorage.getItem(COLOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, color]) => isHexColor(color)),
    );
  } catch {
    return {};
  }
}

function writeStoredCategoryColors(map) {
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function defaultColorForKey(key, index = 0) {
  let hash = index;
  const text = String(key || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return FORCE_LIGHT_PALETTE[Math.abs(hash) % FORCE_LIGHT_PALETTE.length];
}

function categoryKeyOf(point) {
  return point?.categoryCode || point?.categoryTitle || "未分类";
}

function categoryLabelOf(point) {
  return point?.categoryTitle || point?.categoryCode || "未分类";
}

/** 当前选中节点所属分类 key（用于默认只勾选当前分类） */
export function resolveFocusCategoryKey(selectedCode, points = []) {
  if (!selectedCode) return "";
  const found = points.find((point) => point.code === selectedCode);
  if (found?.kind === "CATEGORY") return found.code || categoryKeyOf(found);
  if (found) return categoryKeyOf(found);
  const knownAsCategory = String(selectedCode).startsWith("category.")
    || points.some((point) => point.categoryCode === selectedCode);
  return knownAsCategory ? selectedCode : "";
}

/** 从查询结果收集可勾选分类（含中文名） */
export function collectPaletteCategories(points = []) {
  const map = new Map();
  for (const point of points) {
    if (point?.kind === "CATEGORY") {
      const key = point.code || categoryKeyOf(point);
      if (!key || map.has(key)) continue;
      map.set(key, { key, label: point.title || categoryLabelOf(point) });
      continue;
    }
    const key = categoryKeyOf(point);
    if (!key || map.has(key)) continue;
    map.set(key, { key, label: categoryLabelOf(point) });
  }
  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label, "zh"));
}

/**
 * 图表展示过滤：查询结果不变，仅按勾选分类画图。
 * 当前选中节点始终保留，避免详情与图脱节。
 */
export function applyCategoryVisibility(points = [], enabledKeys = [], selectedCode = "") {
  const enabled = new Set((enabledKeys || []).filter(Boolean));
  return points.filter((point) => {
    if (selectedCode && point.code === selectedCode) return true;
    if (!enabled.size) return false;
    const key = point?.kind === "CATEGORY"
      ? (point.code || categoryKeyOf(point))
      : categoryKeyOf(point);
    return enabled.has(key);
  });
}

function resolveCategoryColor(key, appliedColors, fallbackIndex = 0) {
  if (isHexColor(appliedColors?.[key])) return appliedColors[key];
  return defaultColorForKey(key, fallbackIndex);
}

function edgeEnds(edge) {
  return {
    from: edge?.fromCode || edge?.from || "",
    to: edge?.toCode || edge?.to || "",
    relation: String(edge?.relation || "").toUpperCase(),
  };
}

function styleLink(edge, selectedCode) {
  const prereq = edge.relation === "PREREQUISITE_OF";
  const related = edge.relation === "RELATED_TO";
  const child = edge.relation === "HAS_CHILD";
  const active = selectedCode
    && (edge.from === selectedCode || edge.to === selectedCode);
  return {
    source: edge.from,
    target: edge.to,
    relation: edge.relation,
    lineStyle: {
      color: active ? "#8ec4e3" : prereq ? "#a8c9db" : related ? "#c5ccd6" : "#d5e2ea",
      width: active ? 2.2 : prereq ? 1.6 : 1.1,
      type: prereq ? "solid" : "dashed",
      curveness: child ? 0.05 : 0.12,
      opacity: child ? 0.5 : 0.85,
    },
    symbol: prereq ? ["none", "arrow"] : ["none", "none"],
    symbolSize: prereq ? 8 : 0,
  };
}

/** 从种子点沿关系向外扩展 hops 跳（双向）。 */
function collectNeighborhood(seedCodes, edges, hops = 1) {
  const codes = new Set([...seedCodes].filter(Boolean));
  let frontier = new Set(codes);
  for (let hop = 0; hop < hops; hop += 1) {
    const next = new Set();
    edges.forEach((edge) => {
      const { from, to } = edgeEnds(edge);
      if (!from || !to) return;
      if (frontier.has(from) && !codes.has(to)) {
        codes.add(to);
        next.add(to);
      }
      if (frontier.has(to) && !codes.has(from)) {
        codes.add(from);
        next.add(from);
      }
    });
    frontier = next;
    if (!frontier.size) break;
  }
  return codes;
}

/** 没有先修/相关边时，把同类别其它主题补进来，避免只剩一个孤点。 */
function collectSameCategoryCodes(selectedCode, points, limit = 12) {
  const selected = points.find((point) => point.code === selectedCode);
  if (!selected?.categoryCode) return new Set([selectedCode].filter(Boolean));
  const codes = new Set([selectedCode]);
  points.forEach((point) => {
    if (codes.size >= limit + 1) return;
    if (point.categoryCode === selected.categoryCode) codes.add(point.code);
  });
  return codes;
}

function pointStages(point) {
  if (Array.isArray(point?.stages) && point.stages.length) {
    return point.stages.map((item) => String(item).trim()).filter(Boolean);
  }
  if (point?.stage) {
    return String(point.stage)
      .split(/[、,/|;；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pointStageLabel(point) {
  return pointStages(point).join("、");
}

function pointMatchesStage(point, filter) {
  if (!filter) return true;
  return pointStages(point).includes(filter);
}

export function buildVisiblePoints({
  points,
  edges,
  selectedCode,
  focusMode,
  categoryFilter,
  stageFilter,
  extraNeighborCodes,
}) {
  const filtered = points.filter((point) => {
    if (stageFilter && !pointMatchesStage(point, stageFilter)) return false;
    if (categoryFilter && point.categoryCode !== categoryFilter) return false;
    return true;
  });

  let visible = filtered;
  let emptyReason = "";

  if (focusMode === "neighborhood" && selectedCode) {
    const neighborCodes = collectNeighborhood([selectedCode, ...extraNeighborCodes], edges, 2);
    visible = points.filter((point) => neighborCodes.has(point.code));

    const topicCount = visible.filter((point) => point.kind !== "CATEGORY").length;
    if (topicCount <= 1) {
      const selectedPoint = points.find((point) => point.code === selectedCode);
      const sameCategory = collectSameCategoryCodes(selectedCode, points);
      visible = points.filter((point) => {
        if (sameCategory.has(point.code)) return true;
        if (selectedPoint?.categoryCode && point.code === selectedPoint.categoryCode) return true;
        return false;
      });
      if (!visible.some((point) => point.code === selectedCode) && selectedPoint) {
        visible = [selectedPoint, ...visible];
      }
      if (visible.filter((point) => point.kind !== "CATEGORY").length <= 1) {
        emptyReason = "当前知识点还没有先修/拓展连线，也暂无同分类其它知识点可对照。";
      } else {
        emptyReason = "当前知识点没有先修/拓展连线，已改为展示同分类其它知识点。";
      }
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
      collectNeighborhood([selectedCode, ...extraNeighborCodes], edges, 2).forEach((code) => mustKeep.add(code));
    }
    const keepPoints = points.filter((point) => mustKeep.has(point.code));
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

  return { visible, emptyReason };
}

/**
 * 视图标记只看「图上实际画出的分类」。
 * 仅 1 个分类 → 单分类展开；勾选了多个 → 多分类同屏。
 */
export function describeGraphComposition({
  visible = [],
  selectedCode = "",
  points = [],
  categoryFilter = "",
  focusMode = "neighborhood",
  enabledCategoryKeys = null,
}) {
  const selected = (points || []).find((point) => point.code === selectedCode);
  const knownAsCategoryCode = Boolean(
    selectedCode
    && (
      String(selectedCode).startsWith("category.")
      || (points || []).some((point) => point.categoryCode === selectedCode)
    ),
  );
  const selectedIsCategory = Boolean(
    selected?.kind === "CATEGORY"
    || (!selected && knownAsCategoryCode),
  );
  const selectedCategoryTitle = selectedIsCategory
    ? (selected?.title
      || points.find((point) => point.categoryCode === selectedCode)?.categoryTitle
      || selectedCode)
    : "";

  const topicVisible = (visible || []).filter((point) => point.kind !== "CATEGORY");
  const categoryTitles = [...new Set(
    topicVisible
      .map((point) => point.categoryTitle || "")
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right, "zh"));

  const enabledCount = Array.isArray(enabledCategoryKeys)
    ? enabledCategoryKeys.filter(Boolean).length
    : categoryTitles.length;

  let viewKind = "topic";
  let viewLabel = "知识点聚焦";
  let viewHint = "当前选中的是知识点";

  if (enabledCount <= 1 && categoryTitles.length <= 1) {
    viewKind = "category";
    viewLabel = "单分类展开";
    const name = categoryTitles[0]
      || selectedCategoryTitle
      || selected?.categoryTitle
      || "当前分类";
    viewHint = `图上仅展示「${name}」`;
  } else if (categoryTitles.length > 1 || enabledCount > 1) {
    viewKind = "mixed";
    viewLabel = "多分类同屏";
    viewHint = focusMode === "sample"
      ? `已勾选 ${Math.max(enabledCount, categoryTitles.length)} 个分类（抽样）`
      : `已勾选 ${Math.max(enabledCount, categoryTitles.length)} 个分类`;
  } else if (selected) {
    viewKind = "topic";
    viewLabel = "知识点聚焦";
    viewHint = `聚焦「${selected.title || selected.code}」`;
  }

  if (categoryFilter && categoryTitles.length === 0) {
    const filterTitle = points.find((point) => point.categoryCode === categoryFilter)?.categoryTitle
      || categoryFilter;
    categoryTitles.push(filterTitle);
  }

  const categorySummary = formatCategorySummary(categoryTitles, viewKind);

  return {
    viewKind,
    viewLabel,
    viewHint,
    categorySummary,
    categoryTitles,
    selectedIsCategory,
    selectedCategoryTitle,
  };
}

/** 分类摘要：单分类展开 / 多分类同屏 文案分开，避免都叫「混合」。 */
export function formatCategorySummary(categoryTitles = [], viewKind = "topic", maxShow = 3) {
  const titles = (categoryTitles || []).filter(Boolean);
  if (titles.length === 0) return "当前分类：未标注";
  if (viewKind === "category" || titles.length === 1) {
    return `当前分类：${titles[0] || "未标注"}`;
  }
  if (titles.length <= maxShow) return `同屏分类：${titles.join("、")}`;
  const head = titles.slice(0, maxShow).join("、");
  return `同屏分类：${head} 等共 ${titles.length} 个`;
}

/**
 * 知识点关系力导向图。
 * 节点配色：先改草稿色，点「应用」后才画到图上。
 */
export function KnowledgeForceGraph({
  points = [],
  edges = [],
  selectedCode = "",
  focusMode = "neighborhood",
  categoryFilter = "",
  stageFilter = "",
  extraNeighborCodes = [],
  enabledCategoryKeys = null,
  onEnabledCategoryKeysChange,
  onSelect,
  height = 520,
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const pointsRef = useRef(points);
  onSelectRef.current = onSelect;
  pointsRef.current = points;

  const [appliedColors, setAppliedColors] = useState(() => readStoredCategoryColors());
  const [draftColors, setDraftColors] = useState(() => readStoredCategoryColors());

  const { visible: queryVisible, emptyReason } = useMemo(
    () => buildVisiblePoints({
      points,
      edges,
      selectedCode,
      focusMode,
      categoryFilter,
      stageFilter,
      extraNeighborCodes,
    }),
    [points, edges, selectedCode, focusMode, categoryFilter, stageFilter, extraNeighborCodes],
  );

  const focusCategoryKey = useMemo(
    () => resolveFocusCategoryKey(selectedCode, points),
    [selectedCode, points],
  );

  const paletteCategories = useMemo(() => {
    const list = collectPaletteCategories(queryVisible);
    // 确保当前分类在列表里（即使查询结果暂时没有同分类其它点）
    if (focusCategoryKey && !list.some((item) => item.key === focusCategoryKey)) {
      const selected = points.find((point) => point.code === selectedCode);
      const label = selected?.kind === "CATEGORY"
        ? (selected.title || focusCategoryKey)
        : (selected?.categoryTitle || focusCategoryKey);
      list.unshift({ key: focusCategoryKey, label });
    }
    return list;
  }, [queryVisible, focusCategoryKey, points, selectedCode]);

  const resolvedEnabledKeys = useMemo(() => {
    if (Array.isArray(enabledCategoryKeys)) return enabledCategoryKeys.filter(Boolean);
    return focusCategoryKey ? [focusCategoryKey] : paletteCategories.map((item) => item.key);
  }, [enabledCategoryKeys, focusCategoryKey, paletteCategories]);

  const visible = useMemo(
    () => applyCategoryVisibility(queryVisible, resolvedEnabledKeys, selectedCode),
    [queryVisible, resolvedEnabledKeys, selectedCode],
  );

  /** 配色条：展示查询范围内的分类（含未勾选），便于勾选后显示 */
  const visibleCategories = paletteCategories;

  // 类别列表变化时，补齐草稿色（不覆盖用户已改未应用的值）
  useEffect(() => {
    setDraftColors((current) => {
      const next = { ...current };
      let changed = false;
      visibleCategories.forEach((item, index) => {
        if (!isHexColor(next[item.key])) {
          next[item.key] = resolveCategoryColor(item.key, appliedColors, index);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [visibleCategories, appliedColors]);

  function setCategoryColor(key, color) {
    if (!isHexColor(color)) return;
    setDraftColors((current) => ({ ...current, [key]: color }));
    setAppliedColors((current) => {
      const next = { ...current, [key]: color };
      writeStoredCategoryColors(next);
      return next;
    });
  }

  /** 一键恢复：清空本地自定义配色，回到默认浅色 */
  function resetColors() {
    writeStoredCategoryColors({});
    setAppliedColors({});
    const next = {};
    visibleCategories.forEach((item, index) => {
      next[item.key] = defaultColorForKey(item.key, index);
    });
    setDraftColors(next);
  }

  function toggleCategoryEnabled(key, checked) {
    if (!onEnabledCategoryKeysChange) return;
    const current = new Set(resolvedEnabledKeys);
    if (checked) current.add(key);
    else {
      // 至少保留一个；优先保留当前分类
      if (current.size <= 1) return;
      current.delete(key);
      if (!current.size && focusCategoryKey) current.add(focusCategoryKey);
    }
    // 当前选中所属分类不允许取消，否则图上会丢焦点节点的上下文
    if (focusCategoryKey) current.add(focusCategoryKey);
    onEnabledCategoryKeysChange([...current]);
  }

  const graph = useMemo(() => {
    const codes = new Set(visible.map((point) => point.code));
    const categories = [];
    const categoryIndex = new Map();
    const categoryOrder = new Map();

    visible.forEach((point) => {
      const key = categoryKeyOf(point);
      const name = categoryLabelOf(point);
      if (!categoryIndex.has(name)) {
        categoryIndex.set(name, categories.length);
        categoryOrder.set(key, categories.length);
        categories.push({
          name,
          itemStyle: {
            color: resolveCategoryColor(key, appliedColors, categories.length),
          },
        });
      }
    });

    const nodes = visible.map((point) => {
      const key = categoryKeyOf(point);
      const catName = categoryLabelOf(point);
      const selectedNode = point.code === selectedCode;
      const isCategory = point.kind === "CATEGORY";
      const color = resolveCategoryColor(key, appliedColors, categoryOrder.get(key) || 0);
      return {
        id: point.code,
        name: point.title || point.code,
        category: categoryIndex.get(catName),
        symbolSize: selectedNode ? 42 : isCategory ? 34 : 22,
        value: point.code,
        cursor: "pointer",
        itemStyle: {
          color,
          borderColor: selectedNode ? "#8ec4e3" : "#ffffff",
          borderWidth: selectedNode ? 2 : 1,
          shadowBlur: 0,
        },
        label: {
          show: selectedNode || focusMode === "neighborhood" || visible.length <= 40,
          formatter: point.title || point.code,
          fontSize: selectedNode ? 12 : 10,
          color: "#344054",
          // 点文字也要能选中节点，避免只有圆点可点
          triggerEvent: true,
        },
        raw: point,
      };
    });

    const links = edges
      .map(edgeEnds)
      .filter((edge) => edge.from && edge.to && codes.has(edge.from) && codes.has(edge.to))
      .map((edge) => styleLink(edge, selectedCode));

    const linkKeys = new Set(links.map((link) => `${link.source}=>${link.target}`));
    visible.forEach((point) => {
      if (point.kind === "CATEGORY" || !point.categoryCode) return;
      if (!codes.has(point.categoryCode) || !codes.has(point.code)) return;
      const key = `${point.categoryCode}=>${point.code}`;
      if (linkKeys.has(key)) return;
      links.push(styleLink({
        from: point.categoryCode,
        to: point.code,
        relation: "HAS_CHILD",
      }, selectedCode));
      linkKeys.add(key);
    });

    return { nodes, links, categories, emptyReason };
  }, [visible, edges, selectedCode, focusMode, appliedColors, emptyReason]);

  // 节点/边集合变化时才重跑力导向；纯点选高亮不重排，避免「一直刷新」
  const structureKey = useMemo(() => {
    const nodeIds = graph.nodes.map((node) => node.id).sort().join(",");
    const linkIds = graph.links
      .map((link) => `${link.source}>${link.target}:${link.relation || ""}`)
      .sort()
      .join(",");
    return `${focusMode}|${nodeIds}|${linkIds}`;
  }, [graph.nodes, graph.links, focusMode]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = echarts.init(hostRef.current);
    chart.__kgNeedLayout = true;
    chartRef.current = chart;

    const onClick = (params) => {
      if (params.dataType === "edge" || params.dataType === "link") return;
      // name 是展示标题，不能当编码；点到文字时 data 偶尔不完整，需兜底反查
      const data = params.data && typeof params.data === "object" ? params.data : null;
      let code = data?.id || data?.value || data?.raw?.code || "";
      if (!code && params.name) {
        const list = pointsRef.current || [];
        const byCode = list.find((point) => point.code === params.name);
        if (byCode) {
          code = byCode.code;
        } else {
          const byTitle = list.filter((point) => point.title === params.name);
          if (byTitle.length === 1) code = byTitle[0].code;
        }
      }
      if (!code) return;
      const isNode = params.dataType === "node"
        || Boolean(data?.raw)
        || Boolean(data?.id)
        || params.seriesType === "graph";
      if (isNode) onSelectRef.current?.(String(code));
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
    if (chartRef.current) chartRef.current.__kgNeedLayout = true;
  }, [structureKey]);

  useEffect(() => {
    const host = hostRef.current;
    const chart = chartRef.current;
    if (!host || !chart || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const relayout = Boolean(chart.__kgNeedLayout);
    let nodes = graph.nodes;
    if (!relayout) {
      const prev = chart.getOption()?.series?.[0]?.data || [];
      const pos = new Map(prev.map((node) => [node.id, { x: node.x, y: node.y }]));
      nodes = graph.nodes.map((node) => {
        const point = pos.get(node.id);
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
          return { ...node, x: point.x, y: point.y };
        }
        return node;
      });
    }

    const nodeCount = nodes.length;
    const categoryCount = graph.categories.length;
    // 分类一多，底部图例会占满画布，节点看起来像「消失」；改由上方配色条区分
    const showLegend = categoryCount > 1 && categoryCount <= 6;
    const crowded = nodeCount > 48 || categoryCount > 6;
    const repulsion = focusMode === "neighborhood"
      ? (crowded ? 140 : 280)
      : (crowded ? 72 : 160);
    const gravity = crowded ? 0.18 : 0.06;
    const edgeLength = focusMode === "neighborhood"
      ? (crowded ? [36, 90] : [60, 140])
      : (crowded ? [28, 70] : [40, 100]);
    const zoom = crowded ? Math.max(0.45, Math.min(0.85, 36 / Math.sqrt(Math.max(nodeCount, 1)))) : 1;

    chart.setOption({
      backgroundColor: "transparent",
      animation: relayout,
      tooltip: {
        formatter(params) {
          if (params.dataType === "edge" || params.dataType === "link") {
            const relation = String(params.data.relation || "").toUpperCase();
            const label = relation === "PREREQUISITE_OF"
              ? "先修"
              : relation === "RELATED_TO"
                ? "相关拓展"
                : relation === "HAS_CHILD"
                  ? "同属一类"
                  : "关联";
            return `${params.data.source} → ${params.data.target}<br/>${label}`;
          }
          const point = params.data?.raw;
          if (!point) return params.name;
          return [
            `<strong>${point.title || point.code}</strong>`,
            point.categoryTitle ? `类别：${point.categoryTitle}` : "",
            pointStageLabel(point) ? `学段：${pointStageLabel(point)}` : "",
            "<span style=\"opacity:.65\">点击查看详情</span>",
          ].filter(Boolean).join("<br/>");
        },
      },
      legend: showLegend
        ? [{
          data: graph.categories.map((item) => item.name),
          type: "scroll",
          bottom: 0,
          height: 28,
          textStyle: { fontSize: 11 },
          selectedMode: false,
        }]
        : undefined,
      series: [
        {
          type: "graph",
          layout: relayout ? "force" : "none",
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          categories: graph.categories,
          data: nodes,
          links: graph.links,
          label: { position: "bottom" },
          zoom,
          center: ["50%", "50%"],
          force: {
            repulsion,
            edgeLength,
            gravity,
            friction: 0.22,
            layoutAnimation: relayout && nodeCount <= 80,
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 3 },
            scale: true,
          },
          scaleLimit: { min: 0.25, max: 3 },
        },
      ],
    }, { notMerge: true });
    chart.__kgNeedLayout = false;
    // 分类/节点变多后容器可能被挤压，补一次 resize 保证点可见
    requestAnimationFrame(() => chart.resize());
  }, [graph, focusMode, structureKey]);

  return (
    <div className="kg-force-wrap">
      <div className="kg-force-palette" aria-label="分类显示与配色">
        <div className="kg-force-palette-head">
          <span className="kg-force-palette-label" title="勾选控制图上显示哪些分类；色块改色立即生效">
            显示分类（默认仅当前）
          </span>
          <button
            className="button ghost compact"
            type="button"
            onClick={resetColors}
            title="清空自定义颜色，恢复默认浅色"
          >
            <RotateCcw size={13} />一键恢复
          </button>
        </div>
        {visibleCategories.length ? (
          <div className="kg-force-palette-list">
            {visibleCategories.map((item, index) => {
              const checked = resolvedEnabledKeys.includes(item.key);
              const locked = item.key === focusCategoryKey;
              return (
                <label
                  key={item.key}
                  className={`kg-force-cat-swatch ${checked ? "is-enabled" : "is-dimmed"}`}
                  title={locked ? `${item.label}（当前分类，始终显示）` : item.label}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    aria-label={`显示分类：${item.label}`}
                    onChange={(event) => toggleCategoryEnabled(item.key, event.target.checked)}
                  />
                  <input
                    type="color"
                    value={draftColors[item.key] || defaultColorForKey(item.key, index)}
                    aria-label={`修改分类颜色：${item.label}`}
                    onChange={(event) => setCategoryColor(item.key, event.target.value)}
                  />
                  <span>{item.label || `分类 ${index + 1}`}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <span className="kg-force-palette-empty">暂无可配色分类</span>
        )}
      </div>
      <div ref={hostRef} className="kg-force-chart" style={{ height }} role="img" aria-label="知识图谱力导向图" />
      {!graph.nodes.length && <p className="manager-empty kg-force-empty">当前筛选下没有可展示的知识点</p>}
      {graph.nodes.length > 0 && graph.emptyReason && (
        <p className="kg-force-note" role="status">{graph.emptyReason}</p>
      )}
      {graph.nodes.length > 48 && (
        <p className="kg-force-note" role="status">
          节点较多，已自动缩小视野。可改「展示范围」为「相关范围」，或先按分类筛选。
        </p>
      )}
    </div>
  );
}
