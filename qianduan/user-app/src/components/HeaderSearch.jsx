import { BookOpen, FileText, LoaderCircle, Network, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { coursesApi, knowledgeGraphApi, teachingResourcesApi } from "../api/client.js";

const DEBOUNCE_MS = 280;
const RESULT_LIMIT = 6;

const HINTS = [
  { type: "course", icon: BookOpen, label: "课程", tip: "按课程名称查找已发布课程" },
  { type: "knowledge", icon: Network, label: "知识点", tip: "按标题或编码查找通识知识点" },
  {
    type: "resource",
    icon: FileText,
    label: "讲义资料",
    tip: "展示与知识点相关的已发布讲义（按资料标题、简介或关联知识点编码匹配）",
  },
];

export function HeaderSearch({ session, requireLogin, navigate, onAskKnowledge }) {
  const panelId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState([]);
  const [points, setPoints] = useState([]);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const keyword = query.trim();
    if (!open || !session || !keyword) {
      setCourses([]);
      setPoints([]);
      setResources([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    let alive = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const [coursePage, pointList, resourcePage] = await Promise.all([
          coursesApi.page({ page: 1, size: RESULT_LIMIT, keyword }),
          knowledgeGraphApi.points({ q: keyword, limit: RESULT_LIMIT }),
          teachingResourcesApi.published({ page: 1, size: RESULT_LIMIT, keyword }),
        ]);
        if (!alive) return;
        setCourses(Array.isArray(coursePage?.items) ? coursePage.items : []);
        setPoints(Array.isArray(pointList) ? pointList.slice(0, RESULT_LIMIT) : []);
        setResources(Array.isArray(resourcePage?.items) ? resourcePage.items : []);
      } catch (requestError) {
        if (!alive) return;
        setCourses([]);
        setPoints([]);
        setResources([]);
        setError(requestError.message || "搜索失败，请稍后再试");
      } finally {
        if (alive) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, query, session]);

  function openPanel() {
    setOpen(true);
  }

  function closeAndClear() {
    setOpen(false);
  }

  function goCourse(course) {
    requireLogin(() => {
      navigate(`courses/${course.id}`);
      closeAndClear();
    });
  }

  function goKnowledge(point) {
    requireLogin(() => {
      onAskKnowledge?.(point);
      closeAndClear();
    });
  }

  async function goResource(resource) {
    requireLogin(async () => {
      const binding = Array.isArray(resource.bindings) ? resource.bindings[0] : null;
      if (binding?.courseId) {
        const path = binding.chapterId
          ? `courses/${binding.courseId}/chapters/${binding.chapterId}`
          : `courses/${binding.courseId}`;
        navigate(path);
        closeAndClear();
        return;
      }
      if (resource.courseId) {
        navigate(`courses/${resource.courseId}`);
        closeAndClear();
        return;
      }
      try {
        const data = await teachingResourcesApi.publishedDownload(resource.id);
        if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
        closeAndClear();
      } catch (requestError) {
        setError(requestError.message || "资料暂时无法打开");
      }
    });
  }

  const keyword = query.trim();
  const hasResults = courses.length + points.length + resources.length > 0;
  const showEmptyResults = Boolean(session && keyword && !loading && !error && !hasResults);

  return (
    <div className={`header-search-wrap${open ? " open" : ""}`} ref={rootRef}>
      <label className="header-search">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="搜索课程、知识点和相关讲义"
          aria-expanded={open}
          aria-controls={panelId}
          placeholder="搜索课程、知识点和相关讲义"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={openPanel}
          onClick={openPanel}
          onKeyDown={(event) => {
            if (event.key === "Enter") openPanel();
          }}
        />
      </label>

      {open && (
        <div className="header-search-panel" id={panelId} role="listbox" aria-label="搜索结果">
          {!session ? (
            <div className="header-search-empty">
              <p>登录后可搜索课程、知识点，以及与知识点相关的讲义资料。</p>
              <button className="button primary" type="button" onClick={() => requireLogin()}>
                去登录
              </button>
            </div>
          ) : !keyword ? (
            <div className="header-search-hints">
              <p className="header-search-panel-title">可以搜索</p>
              <ul>
                {HINTS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.type}>
                      <span className="header-search-hint-icon"><Icon size={16} /></span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.tip}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : loading ? (
            <div className="header-search-empty">
              <LoaderCircle size={18} className="spin" />
              <span>正在搜索…</span>
            </div>
          ) : error ? (
            <div className="header-search-empty">
              <p className="header-search-error">{error}</p>
            </div>
          ) : showEmptyResults ? (
            <div className="header-search-empty">
              <p>没有找到与「{keyword}」相关的课程、知识点或讲义</p>
              <small>讲义仅展示与知识点相关的已发布资料，可换知识点名称再试</small>
            </div>
          ) : (
            <div className="header-search-groups">
              <SearchGroup
                title="课程"
                icon={BookOpen}
                items={courses}
                emptyText="无匹配课程"
                renderItem={(course) => (
                  <button type="button" key={course.id} onClick={() => goCourse(course)}>
                    <strong>{course.title}</strong>
                    <small>{[course.subject, course.gradeLevel].filter(Boolean).join(" · ") || "已发布课程"}</small>
                  </button>
                )}
              />
              <SearchGroup
                title="知识点"
                icon={Network}
                items={points}
                emptyText="无匹配知识点"
                renderItem={(point) => (
                  <button type="button" key={point.code} onClick={() => goKnowledge(point)}>
                    <strong>{point.title}</strong>
                    <small>{[point.categoryTitle, point.stage, point.code].filter(Boolean).join(" · ")}</small>
                  </button>
                )}
              />
              <SearchGroup
                title="讲义资料"
                icon={FileText}
                items={resources}
                emptyText="暂无与关键词匹配的相关讲义"
                description="与知识点相关的已发布讲义：按资料标题、简介或关联知识点编码匹配，不是独立题库。"
                renderItem={(resource) => (
                  <button type="button" key={resource.id} onClick={() => goResource(resource)}>
                    <strong>{resource.title}</strong>
                    <small>
                      {resource.knowledgeCode
                        ? `关联知识点 ${resource.knowledgeCode}${resource.subject ? ` · ${resource.subject}` : ""}`
                        : [resource.subject, resource.originalFilename].filter(Boolean).join(" · ") || "已发布讲义"}
                    </small>
                  </button>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, icon: Icon, items, emptyText, description, renderItem }) {
  return (
    <section className="header-search-group">
      <header>
        <Icon size={14} />
        <span>{title}</span>
        <em>{items.length}</em>
      </header>
      {description ? <p className="header-search-group-desc">{description}</p> : null}
      {items.length === 0 ? (
        <p className="header-search-group-empty">{emptyText}</p>
      ) : (
        <div className="header-search-group-list">{items.map(renderItem)}</div>
      )}
    </section>
  );
}
