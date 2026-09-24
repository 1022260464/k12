import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function LearningCalendar({ events = [] }) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selectedKey, setSelectedKey] = useState(() => dateKey(today));
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const days = useMemo(() => calendarDays(month), [month]);
  const selectedEvents = eventsByDay[selectedKey] || [];

  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next);
    setSelectedKey(dateKey(next));
  }

  function backToToday() {
    setMonth(startOfMonth(today));
    setSelectedKey(dateKey(today));
  }

  return (
    <section className="learning-calendar task-widget">
      <header className="task-widget-heading">
        <span><CalendarDays size={18} /></span>
        <div>
          <strong>学习日历</strong>
          <small>同步课程进度、作业与提交记录</small>
        </div>
        <button type="button" className="calendar-today" onClick={backToToday}>今天</button>
      </header>

      <div className="calendar-toolbar">
        <button type="button" aria-label="上一个月" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
        <strong>{month.getFullYear()} 年 {month.getMonth() + 1} 月</strong>
        <button type="button" aria-label="下一个月" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
      </div>

      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid calendar-days">
        {days.map((day, index) => {
          if (!day) return <span className="calendar-blank" key={`blank-${index}`} />;
          const key = dateKey(day);
          const dayEvents = eventsByDay[key] || [];
          const selected = key === selectedKey;
          const isToday = key === dateKey(today);
          return (
            <button
              type="button"
              key={key}
              className={`${selected ? "selected" : ""} ${isToday ? "today" : ""}`.trim()}
              aria-label={`${day.getMonth() + 1}月${day.getDate()}日，${dayEvents.length}条学习动态`}
              onClick={() => setSelectedKey(key)}
            >
              <span>{day.getDate()}</span>
              {dayEvents.length > 0 && (
                <i className={`calendar-dot tone-${dayEvents[0].tone || "todo"}`}>
                  {dayEvents.length > 1 ? dayEvents.length : ""}
                </i>
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar-events">
        <small>{formatSelectedDate(selectedKey)}</small>
        {selectedEvents.length > 0 ? selectedEvents.slice(0, 3).map((event) => (
          <button type="button" key={event.id} onClick={event.onOpen} disabled={!event.onOpen}>
            <i className={`tone-${event.tone || "todo"}`} />
            <span><strong>{event.title}</strong><small>{event.detail}</small></span>
          </button>
        )) : <p>这一天还没有学习动态，安排一小段专注时间吧。</p>}
      </div>
    </section>
  );
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calendarDays(month) {
  const firstWeekday = (month.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ];
}

function groupEventsByDay(events) {
  return events.reduce((result, event) => {
    const key = dateKey(event.date);
    if (!key) return result;
    (result[key] ||= []).push(event);
    return result;
  }, {});
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSelectedDate(key) {
  if (!key) return "学习动态";
  const [, month, day] = key.split("-");
  return `${Number(month)} 月 ${Number(day)} 日`;
}
