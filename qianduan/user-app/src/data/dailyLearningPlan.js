const MAX_TASKS = 3;

export function buildDailyLearningPlan({
  homeworks = [],
  submissions = [],
  history = [],
  mastery = [],
  courseRecommendations = [],
  nextTopics = [],
  prerequisiteGaps = [],
} = {}) {
  const tasks = [];
  const submissionsByHomework = new Map(
    submissions.filter((item) => item?.homeworkId != null).map((item) => [item.homeworkId, item]),
  );
  const pendingHomework = homeworks.find((item) => {
    const submission = submissionsByHomework.get(item.id);
    return item.status === "PUBLISHED" && (!submission || submission.status === "RETURNED");
  });

  if (pendingHomework) {
    const returned = submissionsByHomework.get(pendingHomework.id)?.status === "RETURNED";
    tasks.push({
      id: `homework-${pendingHomework.id}`,
      type: "HOMEWORK",
      eyebrow: returned ? "老师建议修改" : "优先完成",
      title: pendingHomework.title,
      detail: returned ? "根据教师反馈修改后重新提交。" : (pendingHomework.description || "完成老师布置的学习任务。"),
      actionLabel: returned ? "继续修改" : "开始作业",
      route: `tasks/${pendingHomework.id}`,
    });
  }

  const weakest = [...mastery]
    .filter((item) => item?.knowledgeCode)
    .sort((left, right) => Number(left.masteryPercent || 0) - Number(right.masteryPercent || 0))[0];
  const nextTopic = nextTopics[0];
  if (weakest || nextTopic) {
    const focus = weakest || nextTopic;
    const gapTitles = prerequisiteGaps.map((item) => item.title || item.code).filter(Boolean);
    const detail = gapTitles.length
      ? `先补齐「${gapTitles.join("」「")}」，再继续当前主题。`
      : weakest
        ? `当前掌握参考 ${Number(weakest.masteryPercent || 0)}%，建议完成一次分步练习。`
        : (nextTopic.reason || "先修已经基本掌握，可以继续学习这个主题。");
    tasks.push({
      id: `knowledge-${focus.knowledgeCode || focus.code}`,
      type: "KNOWLEDGE",
      eyebrow: gapTitles.length ? "先修缺口" : "巩固知识",
      title: focus.topic || focus.title || focus.knowledgeCode || focus.code,
      detail,
      actionLabel: "开始练习",
      knowledgeCode: focus.knowledgeCode || focus.code,
      topic: focus.topic || focus.title,
      gaps: prerequisiteGaps,
    });
  }

  const activeCourse = history.find((item) => Number(item.progressPercent || 0) < 100);
  const recommended = courseRecommendations[0];
  const course = recommended?.course || recommended;
  if (activeCourse) {
    tasks.push({
      id: `course-${activeCourse.courseId}`,
      type: "COURSE",
      eyebrow: "继续课程",
      title: activeCourse.courseTitle,
      detail: `已完成 ${Number(activeCourse.progressPercent || 0)}%，从上次学习位置继续。`,
      actionLabel: "继续学习",
      route: `courses/${activeCourse.courseId}`,
    });
  } else if (course?.id) {
    tasks.push({
      id: `course-${course.id}`,
      type: "COURSE",
      eyebrow: "推荐课程",
      title: course.title,
      detail: recommended.reason || "这门课程与当前学段和学习记录匹配。",
      actionLabel: "查看课程",
      route: `courses/${course.id}${recommended.chapterId ? `/chapters/${recommended.chapterId}` : ""}`,
    });
  }

  if (!tasks.length) {
    tasks.push({
      id: "explore-course",
      type: "COURSE",
      eyebrow: "第一步",
      title: "选择一门人工智能通识课程",
      detail: "完成一次课程学习或课堂小测后，系统会生成个性化任务。",
      actionLabel: "浏览课程",
      route: "courses",
    });
  }

  return tasks.slice(0, MAX_TASKS);
}
