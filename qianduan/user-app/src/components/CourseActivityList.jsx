import { Bot, BookOpen, Code2, LockKeyhole, PlayCircle } from "lucide-react";
import { resolveCourseActivity } from "../data/courseActivities.js";

const ICONS = {
  CAT_LESSON: BookOpen,
  TEACHING_TOPIC: Bot,
  PYTHON_LAB: Code2,
};

export function CourseActivityList({ activities = [], onLaunch }) {
  if (!activities.length) return null;
  return (
    <section className="course-activity-panel" aria-labelledby="course-activity-title">
      <div className="course-activity-heading">
        <div>
          <p className="eyebrow">互动活动</p>
          <h3 id="course-activity-title">完成这一节的小任务</h3>
        </div>
        <PlayCircle size={21} />
      </div>
      <div className="course-activity-list">
        {activities.map((activity) => {
          const launch = resolveCourseActivity(activity);
          const Icon = ICONS[activity.activityType] || LockKeyhole;
          return (
            <article key={activity.id} className="course-activity-item">
              <Icon size={20} />
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.description || "进入受控教学活动继续学习。"}</p>
              </div>
              <button
                className="button secondary"
                type="button"
                disabled={!launch}
                title={launch ? `打开${activity.title}` : "该活动尚未在当前客户端启用"}
                onClick={() => onLaunch?.(activity, launch)}
              >
                {launch ? "开始活动" : "暂不可用"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
