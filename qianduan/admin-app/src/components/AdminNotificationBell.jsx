import { Bell, BookOpen, ClipboardCheck, FileCheck2, LoaderCircle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { coursesApi, homeworksApi, teachingResourcesApi } from "../api/client.js";

const READ_KEY = "k12-admin-notification-reads";
const PENDING_SUBMIT = new Set(["SUBMITTED", "PENDING_GRADING"]);

const KIND_ICON = {
  course: BookOpen,
  homework: ClipboardCheck,
  grade: ClipboardCheck,
  material: FileCheck2,
  review: FileCheck2,
  rejected: FileCheck2,
  approved: FileCheck2,
  draft: FileCheck2,
};

function loadReadIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function push(items, entry) {
  items.push(entry);
}

async function buildNotifications(isAdmin) {
  const items = [];
  const [coursesResult, homeworksResult, materialsResult] = await Promise.allSettled([
    isAdmin
      ? coursesApi.list()
      : coursesApi.page({ page: 1, size: 100, mine: true }),
    homeworksApi.list(1, 100),
    teachingResourcesApi.page({ page: 1, size: 100 }),
  ]);

  const courses = coursesResult.status === "fulfilled" ? asList(coursesResult.value) : [];
  const homeworks = homeworksResult.status === "fulfilled" ? asList(homeworksResult.value) : [];
  const materials = materialsResult.status === "fulfilled" ? asList(materialsResult.value) : [];

  for (const course of courses.filter((item) => Number(item.status) === 0)) {
    push(items, {
      id: `course-draft-${course.id}-${course.updatedTime || ""}`,
      kind: "course",
      title: "课程未发布",
      body: `「${course.title || `课程 #${course.id}`}」仍是草稿，完善后可发布给学生。`,
      time: course.updatedTime,
      page: "courses",
    });
  }

  for (const homework of homeworks.filter((item) => item.status === "DRAFT")) {
    const title = String(homework.title || "").replace(/（草稿）|\(草稿\)/g, "").trim() || homework.title || `作业 #${homework.id}`;
    push(items, {
      id: `homework-draft-${homework.id}-${homework.updatedTime || ""}`,
      kind: "homework",
      title: "作业未发布",
      body: `「${title}」仍是草稿，布置对象与题目就绪后可发布。`,
      time: homework.updatedTime,
      page: "homeworks",
    });
  }

  for (const material of materials.filter((item) => item.status === "DRAFT")) {
    push(items, {
      id: `material-draft-${material.id}-${material.updatedTime || ""}`,
      kind: "draft",
      title: "资料草稿",
      body: `「${material.title || material.originalFilename || `资料 #${material.id}`}」尚未提交审核。`,
      time: material.updatedTime,
      page: "materials",
    });
  }

  if (isAdmin) {
    for (const material of materials.filter((item) => item.status === "PENDING_REVIEW")) {
      push(items, {
        id: `material-review-${material.id}-${material.updatedTime || ""}`,
        kind: "review",
        title: "资料待审核",
        body: `「${material.title || material.originalFilename || `资料 #${material.id}`}」等待审核。`,
        time: material.updatedTime,
        page: "materials",
      });
    }
  } else {
    for (const material of materials.filter((item) => item.status === "PENDING_REVIEW")) {
      push(items, {
        id: `material-pending-${material.id}-${material.updatedTime || ""}`,
        kind: "review",
        title: "资料审核中",
        body: `「${material.title || material.originalFilename || `资料 #${material.id}`}」已提交，等待管理员审核。`,
        time: material.updatedTime,
        page: "materials",
      });
    }
    for (const material of materials.filter((item) => item.status === "REJECTED")) {
      const tip = material.reviewNote
        ? `：${String(material.reviewNote).slice(0, 60)}${String(material.reviewNote).length > 60 ? "…" : ""}`
        : "。";
      push(items, {
        id: `material-rejected-${material.id}-${material.updatedTime || ""}`,
        kind: "rejected",
        title: "资料已驳回",
        body: `「${material.title || material.originalFilename || `资料 #${material.id}`}」需要修改后重新提交${tip}`,
        time: material.updatedTime,
        page: "materials",
      });
    }
    for (const material of materials.filter((item) => item.status === "APPROVED")) {
      push(items, {
        id: `material-approved-${material.id}-${material.updatedTime || ""}`,
        kind: "approved",
        title: "资料可发布",
        body: `「${material.title || material.originalFilename || `资料 #${material.id}`}」已通过审核，可以发布。`,
        time: material.updatedTime,
        page: "materials",
      });
    }
  }

  const published = homeworks.filter((item) => item.status === "PUBLISHED").slice(0, 15);
  const submissionResults = await Promise.allSettled(
    published.map((homework) => homeworksApi.submissions(homework.id, 1, 50).then((page) => ({
      homework,
      submissions: asList(page),
    }))),
  );

  for (const result of submissionResults) {
    if (result.status !== "fulfilled") continue;
    const { homework, submissions } = result.value;
    const pending = submissions.filter((item) => PENDING_SUBMIT.has(item.status));
    if (!pending.length) continue;
    const latest = pending
      .map((item) => item.submittedTime || item.updatedTime)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || homework.updatedTime;
    push(items, {
      id: `grade-${homework.id}-${pending.length}-${latest || ""}`,
      kind: "grade",
      title: "作业待批改",
      body: `「${homework.title || `作业 #${homework.id}`}」有 ${pending.length} 份提交待处理。`,
      time: latest,
      page: "homeworks",
    });
  }

  return items
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
    .slice(0, 30);
}

export function AdminNotificationBell({ isAdmin, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(loadReadIds);
  const rootRef = useRef(null);

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    buildNotifications(isAdmin)
      .then((next) => { if (alive) setItems(next); })
      .catch((requestError) => { if (alive) setError(requestError.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function markAllRead() {
    const next = new Set(readIds);
    items.forEach((item) => next.add(item.id));
    setReadIds(next);
    saveReadIds(next);
  }

  function openItem(item) {
    const next = new Set(readIds);
    next.add(item.id);
    setReadIds(next);
    saveReadIds(next);
    setOpen(false);
    onNavigate?.(item.page);
  }

  return (
    <div className="notification-root" ref={rootRef}>
      <button
        className="icon-button notification-trigger"
        type="button"
        title="通知"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-panel" role="dialog" aria-label="通知列表">
          <header>
            <div>
              <strong>通知</strong>
              <p>{unreadCount ? `${unreadCount} 条未读` : "暂无未读"}</p>
            </div>
            <div className="notification-panel-actions">
              {items.length > 0 && (
                <button className="text-button" type="button" onClick={markAllRead}>全部已读</button>
              )}
              <button className="icon-button" type="button" title="关闭" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </header>

          {loading ? (
            <div className="notification-empty"><LoaderCircle size={18} />正在同步待办通知</div>
          ) : error ? (
            <div className="notification-empty error">{error}</div>
          ) : !items.length ? (
            <div className="notification-empty">暂无课程、作业或资料相关待办</div>
          ) : (
            <ul className="notification-list">
              {items.map((item) => {
                const unread = !readIds.has(item.id);
                const Icon = KIND_ICON[item.kind] || Bell;
                return (
                  <li key={item.id}>
                    <button
                      className={`notification-item${unread ? " unread" : ""}`}
                      type="button"
                      onClick={() => openItem(item)}
                    >
                      <span className={`notification-icon tone-${item.kind}`}><Icon size={15} /></span>
                      <span className="notification-copy">
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                        {item.time && <small>{formatTime(item.time)}</small>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
