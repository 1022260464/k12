import { ArrowRight, BookOpen, BrainCircuit, ClipboardCheck, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { coursesApi, homeworksApi, knowledgeGraphApi, practiceApi } from "../api/client.js";
import { buildDailyLearningPlan } from "../data/dailyLearningPlan.js";
import { EXPERIENCE } from "../experience/experience.js";

const icons = { HOMEWORK: ClipboardCheck, KNOWLEDGE: BrainCircuit, COURSE: BookOpen };

export function DailyLearningPlan({ session, navigate, onAskTopic, experience = EXPERIENCE.TEEN }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [partial, setPartial] = useState(false);

  useEffect(() => {
    let active = true;
    if (!session) {
      setTasks([]);
      setLoading(false);
      return () => { active = false; };
    }

    async function load() {
      setLoading(true);
      setPartial(false);
      const baseResults = await Promise.allSettled([
        homeworksApi.list(),
        homeworksApi.learningResults(1, 100),
        coursesApi.history(10),
        practiceApi.mastery(),
      ]);
      if (!active) return;
      const value = (index, fallback) => baseResults[index].status === "fulfilled" ? baseResults[index].value : fallback;
      const homeworksValue = value(0, []);
      const resultsValue = value(1, { items: [] });
      const historyValue = value(2, { items: [] });
      const mastery = Array.isArray(value(3, [])) ? value(3, []) : [];
      const masteryHints = mastery.filter((item) => item?.knowledgeCode).map((item) => ({
        knowledgeCode: item.knowledgeCode,
        masteryPercent: Number(item.masteryPercent) || 0,
      }));
      const weakest = [...mastery].filter((item) => item?.knowledgeCode)
        .sort((left, right) => Number(left.masteryPercent || 0) - Number(right.masteryPercent || 0))[0];

      const detailResults = await Promise.allSettled([
        coursesApi.personalized(masteryHints, 4),
        weakest ? knowledgeGraphApi.recommendNext({ focusCode: weakest.knowledgeCode, mastery: masteryHints }) : Promise.resolve([]),
        weakest ? knowledgeGraphApi.prerequisiteGaps(weakest.knowledgeCode, masteryHints) : Promise.resolve([]),
      ]);
      if (!active) return;
      const detail = (index) => detailResults[index].status === "fulfilled" && Array.isArray(detailResults[index].value)
        ? detailResults[index].value : [];
      setTasks(buildDailyLearningPlan({
        homeworks: Array.isArray(homeworksValue) ? homeworksValue : (homeworksValue?.items || []),
        submissions: resultsValue?.items || resultsValue || [],
        history: historyValue?.items || historyValue || [],
        mastery,
        courseRecommendations: detail(0),
        nextTopics: detail(1),
        prerequisiteGaps: detail(2),
      }));
      setPartial([...baseResults, ...detailResults].some((result) => result.status === "rejected"));
      setLoading(false);
    }

    load().catch(() => {
      if (!active) return;
      setTasks(buildDailyLearningPlan());
      setPartial(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  if (!session) return null;
  const primary = experience === EXPERIENCE.PRIMARY;

  return (
    <section className="home-section daily-learning-plan" aria-labelledby="daily-learning-title">
      <header className="section-heading">
        <div>
          <p className="eyebrow">{primary ? "小智今日安排" : "TODAY'S PLAN"}</p>
          <h2 id="daily-learning-title">{primary ? "今天完成这几步" : "今日学习计划"}</h2>
          <p>{partial ? "部分学习数据暂不可用，先显示能够确认的任务。" : "根据待完成作业、课程进度、知识掌握度和先修关系生成。"}</p>
        </div>
      </header>
      {loading ? <div className="daily-plan-loading"><LoaderCircle className="spin" size={20} />正在整理今天的任务</div> : (
        <div className="daily-plan-grid">
          {tasks.map((task, index) => {
            const Icon = icons[task.type] || BookOpen;
            return (
              <article key={task.id}>
                <span className={`daily-plan-icon type-${task.type.toLowerCase()}`}><Icon size={20} /></span>
                <div className="daily-plan-copy">
                  <small>{index + 1}. {task.eyebrow}</small>
                  <h3>{task.title}</h3>
                  <p>{task.detail}</p>
                </div>
                <button type="button" onClick={() => task.type === "KNOWLEDGE"
                  ? onAskTopic?.({ code: task.knowledgeCode, title: task.topic || task.title, gaps: task.gaps })
                  : navigate(task.route)}>
                  {task.actionLabel}<ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
