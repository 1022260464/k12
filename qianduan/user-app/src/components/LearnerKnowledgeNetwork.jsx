import { BookOpen, ChevronDown, Compass, LoaderCircle, Network, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { knowledgeGraphApi, coursesApi } from "../api/client.js";
import { readKnowledgeGraphOverviewCache } from "../utils/knowledgeGraphCache.js";
import { EXPERIENCE } from "../experience/experience.js";

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

const MASTERED_COLOR = "#12b76a";
const LEARNING_COLOR = "#1796d2";
const NEXT_COLOR = "#f79009";
const RELATED_COLOR = "#98a2b3";

/**
 * 学生端：基于已学掌握度 + 图数据库邻居，展示关联知识网络，并推荐下一知识点与课程章节。
 * 不向学生展示内部 knowledge code。
 */
export function LearnerKnowledgeNetwork({ mastery = [], history = [], navigate, onPractice, experience = EXPERIENCE.TEEN }) {
  const primary = experience === EXPERIENCE.PRIMARY;
  const cachedOverview = readKnowledgeGraphOverviewCache();
  const [overview, setOverview] = useState(cachedOverview);
  const [topicRecs, setTopicRecs] = useState([]);
  const [courseTitles, setCourseTitles] = useState(() => new Map());
  const [loading, setLoading] = useState(!cachedOverview);
  const [error, setError] = useState("");
  const [selectedCode, setSelectedCode] = useState("");

  const masteryKey = useMemo(
    () => (mastery || [])
      .filter((item) => item?.knowledgeCode)
      .map((item) => `${item.knowledgeCode}:${item.masteryPercent}:${item.topic || ""}`)
      .sort()
      .join("|"),
    [mastery],
  );

  const masteryHints = useMemo(
    () => (mastery || [])
      .filter((item) => item?.knowledgeCode)
      .map((item) => ({
        knowledgeCode: item.knowledgeCode,
        masteryPercent: Number(item.masteryPercent) || 0,
        topic: item.topic || "",
      })),
    [masteryKey],
  );

  const masteryByCode = useMemo(() => {
    const map = new Map();
    masteryHints.forEach((item) => map.set(item.knowledgeCode, item));
    return map;
  }, [masteryHints]);

  useEffect(() => {
    let active = true;
    if (!overview) setLoading(true);
    setError("");

    knowledgeGraphApi.overview()
      .then(async (data) => {
        if (!active) return;
        setOverview(data || null);

        coursesApi.list()
          .then((list) => {
            if (!active) return;
            const map = new Map();
            (Array.isArray(list) ? list : list?.items || []).forEach((course) => {
              if (course?.id) map.set(Number(course.id), course.title || "相关课程");
            });
            setCourseTitles(map);
          })
          .catch(() => { if (active) setCourseTitles(new Map()); });

        const focusCodes = pickFocusCodes(masteryHints, data?.points || []);
        if (!focusCodes.length) {
          setTopicRecs([]);
          return;
        }

        const settled = await Promise.allSettled(
          focusCodes.slice(0, 3).map((code) => knowledgeGraphApi.recommendNext({
            focusCode: code,
            mastery: masteryHints.map((item) => ({
              knowledgeCode: item.knowledgeCode,
              masteryPercent: item.masteryPercent,
            })),
          })),
        );
        if (!active) return;

        const merged = [];
        const seen = new Set();
        settled.forEach((result) => {
          if (result.status !== "fulfilled" || !Array.isArray(result.value)) return;
          result.value.forEach((row) => {
            if (!row?.code || seen.has(row.code)) return;
            seen.add(row.code);
            merged.push(row);
          });
        });
        setTopicRecs(merged.slice(0, 6));
        setSelectedCode((prev) => prev || focusCodes[0] || "");
      })
      .catch((err) => {
        if (!active) return;
        setOverview(null);
        setTopicRecs([]);
        setError(err?.message || "知识网络暂时无法加载");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [masteryHints]);

  const subgraph = useMemo(
    () => buildLearnerSubgraph(overview, masteryByCode, topicRecs, selectedCode),
    [overview, masteryByCode, topicRecs, selectedCode],
  );

  const courseRecs = useMemo(
    () => buildCourseRecommendations(
      overview?.chapterCovers || [],
      topicRecs,
      masteryByCode,
      history,
      courseTitles,
    ),
    [overview, topicRecs, masteryByCode, history, courseTitles],
  );

  const titleByCode = useMemo(() => {
    const map = new Map();
    (overview?.points || []).forEach((point) => {
      if (point?.code) map.set(point.code, point.title || "相关主题");
    });
    masteryHints.forEach((item) => {
      if (!map.has(item.knowledgeCode) && item.topic) map.set(item.knowledgeCode, item.topic);
    });
    topicRecs.forEach((item) => {
      if (item?.code && item.title) map.set(item.code, item.title);
    });
    return map;
  }, [overview, masteryHints, topicRecs]);

  if (loading) {
    return (
      <section className="report-panel learner-kg-panel">
        <header>
          <div>
            <h2>{primary ? "正在准备下一步" : "我的知识网络"}</h2>
            <p>{primary ? "小智正在整理练习记录和课程建议。" : "根据已学内容找出相关主题，并推荐下一步练习与课程。"}</p>
          </div>
        </header>
        <div className="learner-kg-loading"><LoaderCircle size={20} className="spin" />知识网络加载中…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="report-panel learner-kg-panel">
        <header>
          <div>
            <h2>{primary ? "下一步学习" : "我的知识网络"}</h2>
            <p>{primary ? "学习建议暂时无法读取。" : "根据已学内容找出相关主题，并推荐下一步练习与课程。"}</p>
          </div>
        </header>
        <p className="learner-kg-empty">{error}</p>
      </section>
    );
  }

  const hasMastery = masteryHints.length > 0;

  const recommendations = (
    <div className="learner-recommendations">
      <section className="learner-next-card">
        <header><Target size={15} /><strong>{primary ? "下一步学什么" : "推荐知识点"}</strong></header>
        {topicRecs.length ? (
          <ul className="learner-rec-list">
            {topicRecs.map((item) => (
              <li key={item.code}>
                <button type="button" onClick={() => setSelectedCode(item.code)}>
                  <strong>{item.title || titleByCode.get(item.code) || "相关主题"}</strong>
                  <small>{humanizeReason(item.reason)}</small>
                </button>
                {onPractice && (
                  <button
                    className="button secondary compact"
                    type="button"
                    onClick={() => onPractice(item.title || titleByCode.get(item.code) || "")}
                  >
                    <Compass size={13} />去学习
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="learner-kg-empty">
            {hasMastery ? "暂无明确的下一主题推荐，可继续巩固已学内容。" : "完成一次课堂小测后，小智会安排下一步。"}
          </p>
        )}
      </section>

      <section>
        <header><BookOpen size={15} /><strong>推荐课程章节</strong></header>
        {courseRecs.length ? (
          <ul className="learner-rec-list course">
            {courseRecs.map((item) => (
              <li key={`${item.courseId}-${item.chapterId}`}>
                <div>
                  <strong>{item.courseTitle}</strong>
                  <small>{item.chapterTitle}{item.matchedTitle ? ` · 关联「${item.matchedTitle}」` : ""}</small>
                </div>
                <button
                  className="button secondary compact"
                  type="button"
                  onClick={() => navigate?.(`courses/${item.courseId}/chapters/${item.chapterId}`)}
                >
                  去学习
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="learner-kg-empty">暂无匹配课程章节，可先在课程中心浏览。</p>
        )}
      </section>
    </div>
  );

  const graph = (
    <div className="learner-kg-graph-block">
      <div className="learner-kg-legend">
        <span><i style={{ background: MASTERED_COLOR }} />已掌握</span>
        <span><i style={{ background: LEARNING_COLOR }} />练习中</span>
        <span><i style={{ background: NEXT_COLOR }} />推荐主题</span>
        <span><i style={{ background: RELATED_COLOR }} />关联知识点</span>
      </div>
      <LearnerForceGraph
        nodes={subgraph.nodes}
        links={subgraph.links}
        selectedCode={selectedCode}
        onSelect={setSelectedCode}
        emptyHint={hasMastery ? "相关主题还不够，再完成几次小测后再来看看" : "先完成几次课堂小测，再回来看知识网络"}
      />
    </div>
  );

  return (
    <section className={`report-panel learner-kg-panel ${primary ? "primary-mode" : "teen-mode"}`}>
      <header>
        <div>
          <h2>{primary ? "小智为你安排的下一步" : "我的知识网络"}</h2>
          <p>
            {primary
              ? "根据最近练习找到薄弱点，再推荐适合的知识和课程。"
              : hasMastery
                ? "绿色为已掌握，蓝色为练习中，橙色为推荐下一主题。"
                : "完成 AI 助教小测后，这里会根据掌握情况展示相关主题。"}
          </p>
        </div>
        <strong>{primary ? <Sparkles size={18} /> : <Network size={18} />}</strong>
      </header>

      {primary ? (
        <>
          {recommendations}
          <details className="learner-disclosure learner-graph-disclosure">
            <summary><span><Network size={16} />查看我的知识网络</span><ChevronDown size={16} /></summary>
            {graph}
          </details>
        </>
      ) : (
        <>
          {graph}
          <details className="learner-disclosure learner-rec-disclosure">
            <summary><span><Sparkles size={16} />查看推荐知识点与课程</span><ChevronDown size={16} /></summary>
            {recommendations}
          </details>
        </>
      )}
    </section>
  );
}

function LearnerForceGraph({ nodes, links, selectedCode, onSelect, emptyHint }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const chart = echarts.init(hostRef.current);
    chartRef.current = chart;
    const onClick = (params) => {
      if (params.dataType === "edge") return;
      const id = params.data?.id || params.data?.value;
      if ((params.dataType === "node" || params.seriesType === "graph") && id) onSelect?.(id);
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
  }, [onSelect]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        formatter(params) {
          if (params.dataType === "edge" || params.dataType === "link") {
            return params.data.relationLabel || "关联";
          }
          const raw = params.data?.raw;
          if (!raw) return params.name;
          const lines = [`<strong>${raw.title}</strong>`];
          if (raw.roleLabel) lines.push(raw.roleLabel);
          if (raw.masteryPercent != null) lines.push(`掌握参考 ${raw.masteryPercent}%`);
          return lines.join("<br/>");
        },
      },
      series: [{
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        data: nodes,
        links,
        label: { position: "bottom", color: "#344054", fontSize: 11 },
        force: { repulsion: 220, edgeLength: [50, 120], gravity: 0.08, friction: 0.24 },
        emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
        scaleLimit: { min: 0.4, max: 2.5 },
      }],
    }, { notMerge: true });
  }, [nodes, links]);

  return (
    <div className="learner-kg-force">
      <div ref={hostRef} className="learner-kg-chart" role="img" aria-label="已学关联知识网络" />
      {!nodes.length && <p className="learner-kg-empty overlay">{emptyHint}</p>}
      {selectedCode && nodes.length > 0 && (
        <p className="learner-kg-focus-hint">已选中该主题，可继续点选图上其他主题</p>
      )}
    </div>
  );
}

function pickFocusCodes(masteryHints, points) {
  const pointCodes = new Set((points || []).filter((p) => p.kind !== "CATEGORY").map((p) => p.code));
  const ranked = [...masteryHints]
    .filter((item) => !pointCodes.size || pointCodes.has(item.knowledgeCode))
    .sort((a, b) => b.masteryPercent - a.masteryPercent);
  if (ranked.length) return ranked.map((item) => item.knowledgeCode);
  // 无掌握度时取图谱中若干主题作空态预览
  return (points || [])
    .filter((p) => p.kind !== "CATEGORY")
    .slice(0, 0)
    .map((p) => p.code);
}

function buildLearnerSubgraph(overview, masteryByCode, topicRecs, selectedCode) {
  const points = (overview?.points || []).filter((p) => p.kind !== "CATEGORY");
  const edges = overview?.edges || [];
  if (!points.length) return { nodes: [], links: [] };

  const seedCodes = new Set([...masteryByCode.keys()]);
  topicRecs.forEach((item) => { if (item?.code) seedCodes.add(item.code); });

  if (!seedCodes.size) return { nodes: [], links: [] };

  const neighborCodes = new Set(seedCodes);
  edges.forEach((edge) => {
    if (seedCodes.has(edge.fromCode)) neighborCodes.add(edge.toCode);
    if (seedCodes.has(edge.toCode)) neighborCodes.add(edge.fromCode);
  });

  // 保持整片子图可点选；选中只做高亮，不再裁剪到一跳邻居
  const visibleCodes = neighborCodes;
  const pointByCode = new Map(points.map((p) => [p.code, p]));
  const nextCodes = new Set(topicRecs.map((item) => item.code));

  const nodes = [...visibleCodes]
    .map((code) => pointByCode.get(code))
    .filter(Boolean)
    .map((point) => {
      const mastery = masteryByCode.get(point.code);
      const isNext = nextCodes.has(point.code) && !mastery;
      const selected = point.code === selectedCode;
      let color = RELATED_COLOR;
      let roleLabel = "关联知识点";
      if (mastery) {
        if (mastery.masteryPercent >= 60) {
          color = MASTERED_COLOR;
          roleLabel = `已掌握 · ${mastery.masteryPercent}%`;
        } else {
          color = LEARNING_COLOR;
          roleLabel = `练习中 · ${mastery.masteryPercent}%`;
        }
      } else if (isNext) {
        color = NEXT_COLOR;
        roleLabel = "推荐下一主题";
      }
      return {
        id: point.code,
        name: point.title || "知识点",
        symbolSize: selected ? 36 : mastery ? 28 : isNext ? 26 : 18,
        cursor: "pointer",
        itemStyle: {
          color,
          borderColor: selected ? "#0875ad" : "#fff",
          borderWidth: selected ? 2 : 1,
        },
        label: {
          show: selected || visibleCodes.size <= 28 || Boolean(mastery) || isNext,
          formatter: point.title || "知识点",
        },
        raw: {
          title: point.title || "知识点",
          roleLabel,
          masteryPercent: mastery?.masteryPercent ?? null,
        },
      };
    });

  const codes = new Set(nodes.map((n) => n.id));
  const links = edges
    .filter((edge) => codes.has(edge.fromCode) && codes.has(edge.toCode))
    .map((edge) => {
      const prereq = edge.relation === "PREREQUISITE_OF";
      return {
        source: edge.fromCode,
        target: edge.toCode,
        relationLabel: prereq ? "先修关系" : "相关",
        lineStyle: {
          color: prereq ? "#9dcfc7" : "#d0d5dd",
          width: prereq ? 1.6 : 1.1,
          type: prereq ? "solid" : "dashed",
          curveness: 0.08,
        },
        symbol: prereq ? ["none", "arrow"] : ["none", "none"],
        symbolSize: prereq ? 7 : 0,
      };
    });

  return { nodes, links };
}

function buildCourseRecommendations(chapterCovers, topicRecs, masteryByCode, history, courseTitles) {
  const targetCodes = new Set(topicRecs.map((item) => item.code).filter(Boolean));
  // 薄弱已学主题也可推章节
  masteryByCode.forEach((item, code) => {
    if (item.masteryPercent < 60) targetCodes.add(code);
  });
  if (!targetCodes.size) {
    masteryByCode.forEach((_, code) => targetCodes.add(code));
  }

  const titleByCode = new Map();
  topicRecs.forEach((item) => {
    if (item?.code) titleByCode.set(item.code, item.title);
  });
  masteryByCode.forEach((item, code) => {
    if (item.topic) titleByCode.set(code, item.topic);
  });

  const courseTitleById = new Map(courseTitles instanceof Map ? courseTitles : []);
  (history || []).forEach((item) => {
    if (item?.courseId) courseTitleById.set(Number(item.courseId), item.courseTitle || "相关课程");
  });

  const rows = [];
  const seen = new Set();
  (chapterCovers || []).forEach((cover) => {
    const codes = cover.knowledgeCodes || [];
    const hit = codes.find((code) => targetCodes.has(code));
    if (!hit) return;
    const courseId = Number(cover.courseId);
    const chapterId = Number(cover.chapterId);
    if (!Number.isInteger(courseId) || courseId < 1 || !Number.isInteger(chapterId) || chapterId < 1) return;
    const key = `${courseId}:${chapterId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      courseId,
      chapterId,
      courseTitle: courseTitleById.get(courseId) || "相关课程",
      chapterTitle: cover.title || "推荐章节",
      matchedTitle: titleByCode.get(hit) || null,
    });
  });
  return rows.slice(0, 5);
}

function humanizeReason(reason) {
  if (!reason) return "可根据当前进度继续学习";
  const text = String(reason).trim();
  if (!text) return "可根据当前进度继续学习";
  if (/^[a-z0-9_.-]+$/i.test(text) || /\b[a-z]+(?:\.[a-z0-9_]+)+\b/i.test(text)) {
    return "可根据当前进度继续学习";
  }
  if (/Neo4j|Cypher|vector|embedding|GraphRAG|knowledgeCode|node|edge/i.test(text)) {
    return "可根据当前进度继续学习";
  }
  return text;
}
