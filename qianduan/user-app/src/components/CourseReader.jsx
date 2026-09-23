import { ArrowLeft, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { coursesApi } from "../api/client.js";
import { CourseAttachmentList } from "./CourseAttachmentList.jsx";
import { CourseActivityList } from "./CourseActivityList.jsx";
import { HtmlContent } from "./HtmlContent.jsx";

/**
 * 左右分栏阅读：左侧手风琴目录（章 → 节），右侧正文。
 */
export function CourseReader({
  courseId,
  chapters = [],
  chapter,
  progressByChapter = {},
  onBack,
  onCompleted,
  onSelectChapter,
  onLaunchActivity,
}) {
  const [sectionsByChapter, setSectionsByChapter] = useState({});
  const [chapterDetails, setChapterDetails] = useState({});
  const [expandedIds, setExpandedIds] = useState(() => (chapter?.id ? [chapter.id] : []));
  const [active, setActive] = useState(null);
  const [body, setBody] = useState(null);
  const [visitedByChapter, setVisitedByChapter] = useState({});
  const [activities, setActivities] = useState([]);
  const [loadingToc, setLoadingToc] = useState(true);
  const [loadingBody, setLoadingBody] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const chapterIdsKey = chapters.map((item) => item.id).join(",");

  const activeChapterId = active?.chapterId || chapter?.id;
  const activeChapter = useMemo(
    () => chapters.find((item) => item.id === activeChapterId) || chapter,
    [chapters, activeChapterId, chapter],
  );
  const chapterProgress = progressByChapter[activeChapterId] ?? 0;
  const sections = sectionsByChapter[activeChapterId] || [];
  const visited = visitedByChapter[activeChapterId] || [];

  useEffect(() => {
    let alive = true;
    setLoadingToc(true);
    setError("");
    setSectionsByChapter({});
    setChapterDetails({});
    setVisitedByChapter({});
    setActive(null);
    setBody(null);
    setActivities([]);

    (async () => {
      try {
        const entries = await Promise.all(
          chapters.map(async (item) => {
            const list = await coursesApi.sections(courseId, item.id);
            return [item.id, list];
          }),
        );
        if (!alive) return;
        const map = Object.fromEntries(entries);
        setSectionsByChapter(map);
        const startId = chapter?.id || chapters[0]?.id;
        if (!startId) return;
        setExpandedIds((current) => (current.includes(startId) ? current : [...current, startId]));
        const firstSections = map[startId] || [];
        if (firstSections.length) {
          await loadSection(startId, firstSections[0].id, { syncRoute: false });
        } else {
          await loadChapterIntro(startId, { syncRoute: false });
        }
      } catch (requestError) {
        if (alive) setError(requestError.message);
      } finally {
        if (alive) setLoadingToc(false);
      }
    })();

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, chapterIdsKey]);

  async function ensureChapterDetail(chapterId) {
    if (chapterDetails[chapterId]) return chapterDetails[chapterId];
    const detail = await coursesApi.chapter(courseId, chapterId);
    setChapterDetails((current) => ({ ...current, [chapterId]: detail }));
    return detail;
  }

  async function loadChapterIntro(chapterId, { syncRoute = true } = {}) {
    setLoadingBody(true);
    setError("");
    try {
      const detail = await ensureChapterDetail(chapterId);
      setActive({ type: "chapter", chapterId });
      setBody({ title: detail.title, content: detail.content || "" });
      setActivities([]);
      if (syncRoute) onSelectChapter?.(chapters.find((item) => item.id === chapterId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingBody(false);
    }
  }

  async function loadSection(chapterId, sectionId, { syncRoute = true } = {}) {
    setLoadingBody(true);
    setError("");
    try {
      const [section, sectionActivities] = await Promise.all([
        coursesApi.section(courseId, chapterId, sectionId),
        coursesApi.sectionActivities(courseId, chapterId, sectionId),
      ]);
      setActive({ type: "section", chapterId, sectionId });
      setBody({ title: section.title, content: section.content || "" });
      setActivities(sectionActivities);
      setVisitedByChapter((current) => {
        const prev = current[chapterId] || [];
        return {
          ...current,
          [chapterId]: prev.includes(sectionId) ? prev : [...prev, sectionId],
        };
      });
      if (syncRoute) onSelectChapter?.(chapters.find((item) => item.id === chapterId));
      ensureChapterDetail(chapterId).catch(() => {});
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingBody(false);
    }
  }

  function toggleChapter(chapterId) {
    setExpandedIds((current) => (
      current.includes(chapterId)
        ? current.filter((id) => id !== chapterId)
        : [...current, chapterId]
    ));
  }

  async function complete() {
    if (!activeChapterId) return;
    setSaving(true);
    setError("");
    try {
      await coursesApi.updateProgress(courseId, activeChapterId, 100);
      await onCompleted();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const canComplete = sections.length === 0 || visited.length >= sections.length;
  const chapterIntro = chapterDetails[activeChapterId];

  return (
    <div className="course-reader course-reader-split">
      <aside className="course-toc" aria-label="课程目录">
        <div className="toc-head">
          <button className="text-button toc-back" type="button" onClick={onBack}>
            <ArrowLeft size={16} />返回课程
          </button>
          <h3 className="toc-title">目录</h3>
        </div>
        <div className="toc-scroll">
          {loadingToc ? (
            <p className="loading-state"><LoaderCircle size={16} />加载目录</p>
          ) : (
            <div className="toc-accordion">
              {chapters.map((item, index) => {
                const open = expandedIds.includes(item.id);
                const itemSections = sectionsByChapter[item.id] || [];
                const done = progressByChapter[item.id] === 100;
                return (
                  <div className={`toc-chapter${open ? " is-open" : ""}`} key={item.id}>
                    <button
                      className="toc-chapter-head"
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        toggleChapter(item.id);
                        if (!itemSections.length) loadChapterIntro(item.id);
                      }}
                    >
                      <span className="toc-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="toc-chapter-title">{item.title}</span>
                      {done ? <CheckCircle2 size={14} className="toc-done" /> : null}
                      <ChevronDown size={16} className="toc-chevron" />
                    </button>
                    {open && (
                      <div className="toc-chapter-body">
                        <button
                          className={`toc-section-link${active?.type === "chapter" && active.chapterId === item.id ? " active" : ""}`}
                          type="button"
                          onClick={() => loadChapterIntro(item.id)}
                        >
                          章节导语
                        </button>
                        {itemSections.map((section, sectionIndex) => (
                          <button
                            key={section.id}
                            className={`toc-section-link${active?.type === "section" && active.sectionId === section.id ? " active" : ""}`}
                            type="button"
                            onClick={() => loadSection(item.id, section.id)}
                          >
                            {sectionIndex + 1}. {section.title}
                          </button>
                        ))}
                        {!itemSections.length && <p className="toc-empty">暂无小节</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <div className="course-reader-body">
        <header className="reader-body-head">
          <p className="eyebrow">{activeChapter ? `第 ${chapters.findIndex((item) => item.id === activeChapter.id) + 1} 章` : "课程阅读"}</p>
          <h2>{body?.title || activeChapter?.title || "选择左侧目录开始阅读"}</h2>
        </header>

        {loadingBody ? (
          <p className="loading-state"><LoaderCircle size={18} />正在加载教学内容</p>
        ) : (
          <>
            {active?.type === "section" && chapterIntro?.content ? (
              <details className="chapter-intro-fold">
                <summary>查看本章导语</summary>
                <HtmlContent>{chapterIntro.content}</HtmlContent>
              </details>
            ) : null}
            {body?.content ? (
              <HtmlContent>{body.content}</HtmlContent>
            ) : (
              !loadingToc && <p className="inline-empty">本章尚未添加教学内容，请联系教师。</p>
            )}
            {active?.type === "section" ? (
              <CourseActivityList activities={activities} onLaunch={onLaunchActivity} />
            ) : null}
            {activeChapterId ? <CourseAttachmentList courseId={courseId} chapterId={activeChapterId} /> : null}
            {activeChapterId && (body?.content || sections.length > 0) ? (
              <button
                className="button secondary"
                type="button"
                disabled={saving || chapterProgress === 100 || !canComplete}
                onClick={complete}
              >
                <CheckCircle2 size={16} />
                {chapterProgress === 100
                  ? "本章已完成"
                  : saving
                    ? "正在保存"
                    : !canComplete
                      ? `还需阅读 ${sections.length - visited.length} 节`
                      : "完成本章学习"}
              </button>
            ) : null}
          </>
        )}
        {error && <p className="page-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
