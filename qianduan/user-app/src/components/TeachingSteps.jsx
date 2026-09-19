import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { normalizeTeachingSteps } from "../data/teachingSteps.js";

/** 渲染 AI / 兜底生成的 lesson-steps JSON。 */
export function TeachingSteps({ artifact }) {
  const lesson = useMemo(() => normalizeTeachingSteps(artifact), [artifact]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setCurrent(0);
    setPlaying(false);
  }, [lesson?.title, lesson?.steps?.length]);

  useEffect(() => {
    if (!playing || !lesson) return undefined;
    const timer = window.setInterval(() => {
      setCurrent((value) => {
        if (value >= lesson.steps.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [playing, lesson]);

  if (!lesson) return null;

  const active = Math.min(current, lesson.steps.length - 1);
  const step = lesson.steps[active];
  const atEnd = active >= lesson.steps.length - 1;

  return (
    <section className="teaching-steps" aria-label={lesson.title}>
      <header>
        <strong>{lesson.title}</strong>
        <span>{active + 1}/{lesson.steps.length}</span>
      </header>
      <p className="teaching-goal">{lesson.learningGoal}</p>
      <nav className="teaching-progress" aria-label="讲解步骤">
        {lesson.steps.map((item, index) => (
          <button
            type="button"
            key={item.number}
            className={index === active ? "active" : index < active ? "done" : ""}
            aria-label={`第 ${item.number} 步：${item.label}`}
            aria-current={index === active ? "step" : undefined}
            onClick={() => {
              setPlaying(false);
              setCurrent(index);
            }}
          />
        ))}
      </nav>
      <div className="teaching-step-content" aria-live="polite">
        <small>第 {step.number} 步</small>
        <strong>{step.label}</strong>
        <p>{step.detail}</p>
      </div>
      <footer>
        <button
          type="button"
          title={playing ? "暂停" : "自动播放"}
          aria-label={playing ? "暂停自动播放" : "自动播放步骤"}
          onClick={() => {
            if (playing) {
              setPlaying(false);
              return;
            }
            if (atEnd) setCurrent(0);
            setPlaying(true);
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          title="重来"
          aria-label="从第一步重来"
          onClick={() => {
            setPlaying(false);
            setCurrent(0);
          }}
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          title="上一步"
          aria-label="上一步"
          disabled={active === 0 || playing}
          onClick={() => setCurrent(active - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          title="下一步"
          aria-label="下一步"
          disabled={atEnd || playing}
          onClick={() => setCurrent(active + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </footer>
    </section>
  );
}
