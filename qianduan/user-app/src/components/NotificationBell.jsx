import { Bell, ClipboardCheck, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { homeworksApi } from "../api/client.js";

const READ_KEY = "k12-user-notification-reads";

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

function buildNotifications(homeworks, results) {
  const titleById = new Map((homeworks || []).map((item) => [String(item.id), item.title || `作业 #${item.id}`]));
  const submissionByHomework = new Map((results || []).map((item) => [String(item.homeworkId), item]));
  const items = [];

  for (const result of results || []) {
    const title = titleById.get(String(result.homeworkId)) || `作业 #${result.homeworkId}`;
    const when = result.gradedTime || result.updatedTime || result.submittedTime;
    if (result.status === "RETURNED") {
      const tip = result.feedback
        ? `：${String(result.feedback).slice(0, 80)}${String(result.feedback).length > 80 ? "…" : ""}`
        : "。";
      items.push({
        id: `returned-${result.id}-${result.version || 0}`,
        kind: "returned",
        title: "作业已退回",
        body: `「${title}」需要修改后重新提交${tip}`,
        time: when,
        href: `tasks/${result.homeworkId}`,
      });
    } else if (result.status === "GRADED") {
      const scoreText = result.score == null ? "" : `，得分 ${result.score}`;
      const tip = result.feedback
        ? `。反馈：${String(result.feedback).slice(0, 80)}${String(result.feedback).length > 80 ? "…" : ""}`
        : "。";
      items.push({
        id: `graded-${result.id}-${result.version || 0}`,
        kind: "graded",
        title: "作业已批改",
        body: `「${title}」已完成批改${scoreText}${tip}`,
        time: when,
        href: `tasks/${result.homeworkId}`,
      });
    }
  }

  for (const homework of homeworks || []) {
    if (homework.status !== "PUBLISHED") continue;
    const submission = submissionByHomework.get(String(homework.id));
    if (submission) continue;
    items.push({
      id: `todo-${homework.id}-${homework.updatedTime || ""}`,
      kind: "todo",
      title: "新作业待完成",
      body: `「${homework.title || `作业 #${homework.id}`}」等待你完成。`,
      time: homework.updatedTime,
      href: `tasks/${homework.id}`,
    });
  }

  return items
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
    .slice(0, 20);
}

export function NotificationBell({ session, navigate }) {
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
    if (!session) {
      setItems([]);
      setOpen(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      homeworksApi.list(1, 50),
      homeworksApi.learningResults(1, 30),
    ])
      .then(([homeworkPage, resultPage]) => {
        if (!alive) return;
        setItems(buildNotifications(homeworkPage?.items || [], resultPage?.items || []));
      })
      .catch((requestError) => {
        if (alive) setError(requestError.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [session]);

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
    navigate(item.href);
  }

  if (!session) return null;

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
        <Bell size={17} />
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
            <div className="notification-empty"><LoaderCircle size={18} />正在同步作业通知</div>
          ) : error ? (
            <div className="notification-empty error">{error}</div>
          ) : !items.length ? (
            <div className="notification-empty">暂无作业相关通知</div>
          ) : (
            <ul className="notification-list">
              {items.map((item) => {
                const unread = !readIds.has(item.id);
                const Icon = item.kind === "returned" ? RotateCcw : ClipboardCheck;
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
