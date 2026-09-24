const DAY_MS = 24 * 60 * 60 * 1000;

export function buildLearningActivity({ events: recordedEvents = [], history = [], results = [], attempts = [] } = {}, now = new Date()) {
  const legacyEvents = [
    ...history.flatMap((item) => item?.lastLearningTime ? [{
      id: `course-${item.courseId}-${item.lastLearningTime}`,
      type: "COURSE",
      title: item.courseTitle || "课程学习",
      detail: `课程进度 ${Number(item.progressPercent || 0)}%`,
      time: item.lastLearningTime,
      route: item.courseId ? `courses/${item.courseId}` : "courses",
    }] : []),
    ...results.flatMap((item) => {
      const time = item?.gradedTime || item?.submittedTime || item?.updatedTime;
      if (!time) return [];
      return [{
        id: `homework-${item.id || item.homeworkId}-${time}`,
        type: "HOMEWORK",
        title: item.homeworkTitle || "作业记录",
        detail: item.status === "GRADED" && item.score != null ? `已批改 ${item.score} 分` : "已提交作业",
        time,
        route: item.homeworkId ? `tasks/${item.homeworkId}` : "tasks",
      }];
    }),
    ...attempts.flatMap((item) => item?.createdTime ? [{
      id: `practice-${item.id || item.runId}-${item.createdTime}`,
      type: "PRACTICE",
      title: item.topic || "AI 课堂小测",
      detail: item.scorePercent == null ? "完成一次练习" : `练习得分 ${item.scorePercent}%`,
      time: item.createdTime,
      route: "ai-studio",
    }] : []),
  ];
  const serverEvents = recordedEvents.map((item) => ({
    id: `event-${item.id}`,
    type: item.eventType,
    title: item.title || eventTitle(item.eventType),
    detail: item.detail || eventTitle(item.eventType),
    time: item.occurredTime,
    route: eventRoute(item),
  }));
  const events = (serverEvents.length ? serverEvents : legacyEvents).filter((item) => isValidDate(item.time))
    .sort((left, right) => new Date(right.time) - new Date(left.time));

  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * DAY_MS);
    const key = dateKey(date);
    const dayEvents = events.filter((item) => dateKey(new Date(item.time)) === key);
    return {
      key,
      label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date).replace("周", ""),
      dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
      isToday: index === 6,
      events: dayEvents,
      count: dayEvents.length,
    };
  });

  return {
    events,
    days,
    activeDays: days.filter((item) => item.count > 0).length,
    weeklyEvents: days.reduce((sum, item) => sum + item.count, 0),
    todayEvents: days[6]?.count || 0,
    latest: events[0] || null,
  };
}

function eventRoute(item) {
  if (item.courseId) return `courses/${item.courseId}`;
  if (item.sourceType === "HOMEWORK") return `tasks/${item.sourceId}`;
  if (item.sourceType === "VISUAL_MISSION") return "visual-code-lab";
  if (item.sourceType === "PRACTICE") return "ai-studio";
  return "progress";
}

function eventTitle(type) {
  return ({
    COURSE_PROGRESS: "课程学习",
    HOMEWORK_SUBMITTED: "作业已提交",
    HOMEWORK_GRADED: "作业已批改",
    PRACTICE_COMPLETED: "AI 小测完成",
    VISUAL_MISSION_ATTEMPTED: "图形化编程练习",
    VISUAL_MISSION_COMPLETED: "图形化编程闯关完成",
  })[type] || "学习动态";
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value) {
  return value && !Number.isNaN(new Date(value).getTime());
}
