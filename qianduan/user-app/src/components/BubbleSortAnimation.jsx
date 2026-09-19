import { Maximize2, Pause, Play, RotateCcw, StepForward, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeBarSortAnimation } from "../data/animation.js";

/** 通用条形算法播放器：排序 / 查找等确定性动画帧。 */
export function BubbleSortAnimation({ artifact }) {
  const animation = useMemo(() => normalizeBarSortAnimation(artifact), [artifact]);
  const [stepIndex, setStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setStepIndex(-1);
    setPlaying(false);
    setExpanded(false);
  }, [animation?.title, animation?.steps?.length, animation?.animationType]);

  useEffect(() => {
    if (!playing || !animation) return undefined;
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, animation.steps.length - 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, [playing, animation]);

  useEffect(() => {
    if (animation && stepIndex >= animation.steps.length - 1) setPlaying(false);
  }, [animation, stepIndex]);

  if (!animation) return null;

  const player = (
    <AnimationPlayer
      animation={animation}
      stepIndex={stepIndex}
      playing={playing}
      expanded={expanded}
      onTogglePlayback={() => {
        if (playing) {
          setPlaying(false);
          return;
        }
        if (stepIndex >= animation.steps.length - 1) setStepIndex(-1);
        setPlaying(true);
      }}
      onStep={() => setStepIndex((current) => Math.min(current + 1, animation.steps.length - 1))}
      onRestart={() => {
        setPlaying(false);
        setStepIndex(-1);
      }}
      onExpand={() => setExpanded(true)}
      onCloseExpand={() => setExpanded(false)}
    />
  );

  if (!expanded) return player;

  return createPortal(
    <div className="animation-modal-backdrop" role="presentation" onMouseDown={() => setExpanded(false)}>
      <div className="animation-modal" role="dialog" aria-modal="true" aria-label={animation.title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="animation-modal-head">
          <div>
            <strong>{animation.title}</strong>
            <p>可播放、暂停、单步查看每次比较、交换或查找。</p>
          </div>
          <button className="icon-button" type="button" title="关闭" onClick={() => setExpanded(false)}>
            <X size={18} />
          </button>
        </header>
        {player}
      </div>
    </div>,
    document.body,
  );
}

function AnimationPlayer({
  animation,
  stepIndex,
  playing,
  expanded,
  onTogglePlayback,
  onStep,
  onRestart,
  onExpand,
  onCloseExpand,
}) {
  const step = animation.steps[stepIndex];
  const values = step?.values || animation.initialValues;
  const maxValue = Math.max(1, ...animation.initialValues, ...values);
  const isComplete = stepIndex === animation.steps.length - 1;
  const highlight = new Set(Array.isArray(step?.indices) ? step.indices : []);

  return (
    <section className={`sort-animation ${expanded ? "expanded" : ""}`} aria-label={animation.title}>
      <header>
        <strong>{animation.title}</strong>
        <span>{stepIndex + 1}/{animation.steps.length}</span>
      </header>
      <div className="sort-bars" role="img" aria-label={`当前数字顺序：${values.join("、")}`}>
        {values.map((value, index) => (
          <div className="sort-column" key={index}>
            <div className="sort-bar-track">
              <span
                className={`sort-bar ${highlight.has(index) ? `action-${step.action}` : ""}`}
                style={{ height: `${Math.max(10, (value / maxValue) * 100)}%` }}
              />
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="sort-narration" aria-live="polite">
        {step?.narration || "观察数字顺序，开始逐步比较。"}
      </p>
      <div className="sort-controls">
        <button type="button" onClick={onTogglePlayback} title={playing ? "暂停" : "播放"} aria-label={playing ? "暂停动画" : "播放动画"}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" onClick={onStep} disabled={playing || isComplete} title="下一步" aria-label="下一步">
          <StepForward size={16} />
        </button>
        <button type="button" onClick={onRestart} title="重来" aria-label="重来">
          <RotateCcw size={16} />
        </button>
        {!expanded ? (
          <button type="button" onClick={onExpand} title="放大演示" aria-label="放大演示">
            <Maximize2 size={16} />
          </button>
        ) : (
          <button type="button" onClick={onCloseExpand} title="收起" aria-label="收起放大">
            <X size={16} />
          </button>
        )}
        {step?.pass && <span>第 {step.pass} 轮</span>}
      </div>
    </section>
  );
}
