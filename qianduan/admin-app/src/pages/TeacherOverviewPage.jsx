import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  FileEdit,
  Network,
  Newspaper,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi, homeworksApi, knowledgeGraphApi, teachingResourcesApi } from "../api/client.js";

const HOMEWORK_STATUS = { DRAFT: "草稿", PUBLISHED: "已发布", CLOSED: "已关闭" };
const MATERIAL_STATUS = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审核",
  APPROVED: "审核通过",
  REJECTED: "已驳回",
  PUBLISHED: "已发布",
  WITHDRAWN: "已撤回",
};

export function TeacherOverviewPage({ onNavigate, notify }) {
  const [courses, setCourses] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [graphOverview, setGraphOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(true);

  async function loadFast() {
    setLoading(true);
    const [coursesResult, homeworksResult, materialsResult] = await Promise.allSettled([
      coursesApi.page({ page: 1, size: 100, mine: true }),
      homeworksApi.list(1, 100),
      teachingResourcesApi.page({ page: 1, size: 100 }),
    ]);
    setCourses(coursesResult.status === "fulfilled" ? (coursesResult.value?.items || []) : []);
    setHomeworks(homeworksResult.status === "fulfilled" ? (homeworksResult.value || []) : []);
    setMaterials(materialsResult.status === "fulfilled" ? (materialsResult.value?.items || []) : []);
    if ([coursesResult, homeworksResult, materialsResult].some((result) => result.status === "rejected")) {
      const firstError = [coursesResult, homeworksResult, materialsResult]
        .find((result) => result.status === "rejected")?.reason;
      notify(firstError?.message || "部分数据暂时无法读取", "error");
    }
    setLoading(false);
  }

  async function loadGraph() {
    setGraphLoading(true);
    try {
      const graph = await knowledgeGraphApi.overview();
      setGraphOverview(graph);
    } catch {
      setGraphOverview(null);
    } finally {
      setGraphLoading(false);
    }
  }

  function load() {
    loadFast();
    loadGraph();
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => buildStats(courses, homeworks, materials), [courses, homeworks, materials]);
  const drafts = useMemo(() => collectDrafts(courses, homeworks, materials).slice(0, 6), [courses, homeworks, materials]);
  const published = useMemo(() => collectPublished(courses, homeworks, materials).slice(0, 6), [courses, homeworks, materials]);
  const graphStats = useMemo(() => {
    const points = graphOverview?.points?.length || 0;
    const edges = graphOverview?.edges?.length || 0;
    const chapters = graphOverview?.chapterCovers?.length || 0;
    const coversBound = (graphOverview?.chapterCovers || [])
      .filter((chapter) => (chapter.knowledgeCodes || []).length > 0).length;
    const explains = graphOverview?.explainsCount || 0;
    const ready = Boolean(graphOverview?.status?.ready);
    return { points, edges, chapters, coversBound, explains, ready };
  }, [graphOverview]);

  const cards = [
    { id: "courses", label: "我的课程", hint: `${stats.courses.draft} 草稿 · ${stats.courses.published} 已发布`, count: courses.length, icon: BookOpen, tone: "blue" },
    { id: "homeworks", label: "我的作业", hint: `${stats.homeworks.draft} 草稿 · ${stats.homeworks.published} 已发布`, count: homeworks.length, icon: ClipboardCheck, tone: "green" },
    { id: "materials", label: "教学资料", hint: `${stats.materials.draft} 草稿 · ${stats.materials.published} 已发布`, count: materials.length, icon: FileCheck2, tone: "amber" },
  ];

  return (
    <section className="page-section">
      <header className="page-heading">
        <div>
          <p className="eyebrow">TEACHING WORKSPACE</p>
          <h1>教学工作台</h1>
          <p>汇总草稿与已发布情况，快速进入课程、作业与资料模块。</p>
        </div>
        <button className="button ghost" type="button" onClick={load} disabled={loading && graphLoading}>
          <RefreshCw size={17} />{(loading || graphLoading) ? "刷新中..." : "刷新"}
        </button>
      </header>

      <div className="overview-metrics teacher-overview-metrics">
        {cards.map(({ id, label, hint, count, icon: Icon, tone }) => (
          <button className={`teacher-stat-card tone-${tone}`} type="button" key={id} onClick={() => onNavigate(id)}>
            <span className="teacher-stat-icon"><Icon size={22} /></span>
            <div className="teacher-stat-copy">
              <strong>{loading ? "-" : count}</strong>
              <small>{label}</small>
              <em>{loading ? "读取中..." : hint}</em>
            </div>
            <span className="teacher-stat-go" aria-hidden="true"><ArrowRight size={16} /></span>
          </button>
        ))}
      </div>

      <button
        className={`teacher-kg-card${graphLoading ? " is-loading" : ""}`}
        type="button"
        onClick={() => !graphLoading && onNavigate("knowledge")}
        disabled={graphLoading}
      >
        <span className="teacher-stat-icon"><Network size={22} /></span>
        <div className="teacher-stat-copy">
          <strong>
            {graphLoading ? "知识图谱加载中…" : (graphStats.ready ? "知识图谱已连通" : "知识图谱")}
          </strong>
          <small>查看力导向关系图、章节覆盖与教学闭环</small>
          <div className="teacher-kg-metrics">
            <span>知识点 {graphLoading ? "加载中" : graphStats.points}</span>
            <span>关系 {graphLoading ? "加载中" : graphStats.edges}</span>
            <span>已绑章节 {graphLoading ? "加载中" : `${graphStats.coversBound}/${graphStats.chapters}`}</span>
            <span>讲解边 {graphLoading ? "加载中" : graphStats.explains}</span>
          </div>
        </div>
        <span className="teacher-stat-go" aria-hidden="true"><ArrowRight size={16} /></span>
      </button>

      <div className="teacher-overview-grid">
        <section className="data-panel teacher-chart-panel">
          <header>
            <strong><Sparkles size={16} />资源分布</strong>
            <small>草稿 / 已发布对比</small>
          </header>
          <div className="teacher-chart-body">
            {loading ? <p className="teacher-empty">正在汇总图表...</p> : (
              <>
                <StatusBars
                  title="课程"
                  total={courses.length}
                  segments={[
                    { label: "草稿", value: stats.courses.draft, tone: "amber" },
                    { label: "已发布", value: stats.courses.published, tone: "blue" },
                  ]}
                />
                <StatusBars
                  title="作业"
                  total={homeworks.length}
                  segments={[
                    { label: "草稿", value: stats.homeworks.draft, tone: "amber" },
                    { label: "已发布", value: stats.homeworks.published, tone: "green" },
                    { label: "已关闭", value: stats.homeworks.closed, tone: "slate" },
                  ]}
                />
                <StatusBars
                  title="教学资料"
                  total={materials.length}
                  segments={[
                    { label: "草稿", value: stats.materials.draft, tone: "amber" },
                    { label: "审核中", value: stats.materials.review, tone: "blue" },
                    { label: "已发布", value: stats.materials.published, tone: "green" },
                    { label: "其他", value: stats.materials.other, tone: "slate" },
                  ]}
                />
              </>
            )}
          </div>
        </section>

        <section className="data-panel teacher-feed-panel">
          <header>
            <strong><FileEdit size={16} />待办草稿</strong>
            <button className="button ghost compact" type="button" onClick={() => onNavigate("courses")}>去处理</button>
          </header>
          <FeedList
            loading={loading}
            empty="暂无草稿，可以从课程或作业开始创建。"
            items={drafts}
            onOpen={(item) => onNavigate(item.module)}
          />
        </section>

        <section className="data-panel teacher-feed-panel">
          <header>
            <strong><Newspaper size={16} />最近发布</strong>
            <button className="button ghost compact" type="button" onClick={() => onNavigate("materials")}>查看资料</button>
          </header>
          <FeedList
            loading={loading}
            empty="还没有已发布内容。"
            items={published}
            onOpen={(item) => onNavigate(item.module)}
          />
        </section>
      </div>

      <section className="data-panel teacher-overview-tips">
        <header><strong>快捷说明</strong></header>
        <div className="teacher-tip-list">
          <p><BookOpen size={16} /><span>课程可手工新建或 JSON 导入；发布后才能布置作业并关联教学资料。</span></p>
          <p><ClipboardCheck size={16} /><span>作业草稿中可批量导入题目、上传附件，并勾选接收学生后发布。</span></p>
          <p><FileCheck2 size={16} /><span>教学资料上传后需审核发布，学生才能在课程页下载附件。</span></p>
        </div>
      </section>
    </section>
  );
}

function StatusBars({ title, total, segments }) {
  const safeTotal = Math.max(total, 1);
  return (
    <article className="teacher-status-chart">
      <div className="teacher-status-chart-head">
        <strong>{title}</strong>
        <span>共 {total} 项</span>
      </div>
      <div className="teacher-status-track" role="img" aria-label={`${title}状态分布`}>
        {segments.filter((item) => item.value > 0).map((item) => (
          <span
            key={item.label}
            className={`teacher-status-seg tone-${item.tone}`}
            style={{ width: `${(item.value / safeTotal) * 100}%` }}
            title={`${item.label} ${item.value}`}
          />
        ))}
        {total === 0 && <span className="teacher-status-seg tone-empty" style={{ width: "100%" }} />}
      </div>
      <div className="teacher-status-legend">
        {segments.map((item) => (
          <span key={item.label}><i className={`tone-${item.tone}`} />{item.label} {item.value}</span>
        ))}
      </div>
    </article>
  );
}

function FeedList({ loading, empty, items, onOpen }) {
  if (loading) return <p className="teacher-empty">正在加载...</p>;
  if (!items.length) return <p className="teacher-empty">{empty}</p>;
  return (
    <ul className="teacher-feed-list">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" onClick={() => onOpen(item)}>
            <span className={`teacher-feed-badge tone-${item.tone}`}>{item.kind}</span>
            <span className="teacher-feed-copy">
              <strong>{item.title}</strong>
              <small>{item.meta}</small>
            </span>
            <time>{item.timeLabel}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}

function buildStats(courses, homeworks, materials) {
  return {
    courses: {
      draft: courses.filter((item) => Number(item.status) === 0).length,
      published: courses.filter((item) => Number(item.status) === 1).length,
    },
    homeworks: {
      draft: homeworks.filter((item) => item.status === "DRAFT").length,
      published: homeworks.filter((item) => item.status === "PUBLISHED").length,
      closed: homeworks.filter((item) => item.status === "CLOSED").length,
    },
    materials: {
      draft: materials.filter((item) => item.status === "DRAFT").length,
      review: materials.filter((item) => ["PENDING_REVIEW", "APPROVED"].includes(item.status)).length,
      published: materials.filter((item) => item.status === "PUBLISHED").length,
      other: materials.filter((item) => !["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED"].includes(item.status)).length,
    },
  };
}

function collectDrafts(courses, homeworks, materials) {
  return [
    ...courses.filter((item) => Number(item.status) === 0).map((item) => ({
      key: `course-${item.id}`,
      module: "courses",
      kind: "课程",
      tone: "blue",
      title: item.title,
      meta: `${item.subject || "-"} · ${item.gradeLevel || "-"}`,
      time: item.updatedTime,
      timeLabel: formatRelative(item.updatedTime),
    })),
    ...homeworks.filter((item) => item.status === "DRAFT").map((item) => ({
      key: `homework-${item.id}`,
      module: "homeworks",
      kind: "作业",
      tone: "green",
      title: String(item.title || "").replace(/（草稿）|\(草稿\)/g, "").trim() || item.title,
      meta: HOMEWORK_STATUS[item.status] || item.status,
      time: item.updatedTime,
      timeLabel: formatRelative(item.updatedTime),
    })),
    ...materials.filter((item) => ["DRAFT", "PENDING_REVIEW", "REJECTED"].includes(item.status)).map((item) => ({
      key: `material-${item.id}`,
      module: "materials",
      kind: "资料",
      tone: "amber",
      title: item.title,
      meta: MATERIAL_STATUS[item.status] || item.status,
      time: item.updatedTime,
      timeLabel: formatRelative(item.updatedTime),
    })),
  ].sort((a, b) => timeValue(b.time) - timeValue(a.time));
}

function collectPublished(courses, homeworks, materials) {
  return [
    ...courses.filter((item) => Number(item.status) === 1).map((item) => ({
      key: `course-p-${item.id}`,
      module: "courses",
      kind: "课程",
      tone: "blue",
      title: item.title,
      meta: `${item.subject || "-"} · 已发布`,
      time: item.updatedTime,
      timeLabel: formatRelative(item.updatedTime),
    })),
    ...homeworks.filter((item) => item.status === "PUBLISHED").map((item) => ({
      key: `homework-p-${item.id}`,
      module: "homeworks",
      kind: "作业",
      tone: "green",
      title: item.title,
      meta: "已发布给学生",
      time: item.updatedTime,
      timeLabel: formatRelative(item.updatedTime),
    })),
    ...materials.filter((item) => item.status === "PUBLISHED").map((item) => ({
      key: `material-p-${item.id}`,
      module: "materials",
      kind: "资料",
      tone: "amber",
      title: item.title,
      meta: item.subject || "已发布",
      time: item.publishedTime || item.updatedTime,
      timeLabel: formatRelative(item.publishedTime || item.updatedTime),
    })),
  ].sort((a, b) => timeValue(b.time) - timeValue(a.time));
}

function timeValue(value) {
  const stamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(stamp) ? stamp : 0;
}

function formatRelative(value) {
  if (!value) return "-";
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return "-";
  const delta = Date.now() - stamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "刚刚";
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟前`;
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`;
  if (delta < 7 * day) return `${Math.floor(delta / day)} 天前`;
  return new Date(value).toLocaleDateString("zh-CN");
}
