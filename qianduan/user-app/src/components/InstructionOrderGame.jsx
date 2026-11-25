import { CheckCircle2, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function shuffleOnce(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  // 开头就完全正确会失去练习意义，交换首尾再洗一次
  if (copy.length > 1 && copy.every((item, index) => item.id === items[index].id)) {
    [copy[0], copy[copy.length - 1]] = [copy[copy.length - 1], copy[0]];
  }
  return copy;
}

/** 课堂内「编程小任务」：把步骤卡排成正确的顺序。答错可撤销重排，不设失败。 */
export function InstructionOrderGame({ game, completeLabel, onComplete }) {
  const pool = useMemo(() => shuffleOnce(game.steps), [game]);
  const correctOrder = useMemo(() => game.steps.map((item) => item.id), [game]);
  const [order, setOrder] = useState([]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(false);

  const remaining = pool.filter((item) => !order.includes(item.id));

  useEffect(() => {
    if (solved || order.length !== game.steps.length) return;
    if (order.every((id, index) => id === correctOrder[index])) {
      setSolved(true);
      setWrong(false);
    } else {
      setWrong(true);
    }
  }, [order, correctOrder, game.steps.length, solved]);

  function pick(id) {
    if (solved) return;
    setWrong(false);
    setOrder((current) => [...current, id]);
  }

  function undo() {
    if (solved) return;
    setWrong(false);
    setOrder((current) => current.slice(0, -1));
  }

  function reset() {
    if (solved) return;
    setWrong(false);
    setOrder([]);
  }

  return (
    <section className="instruction-order" aria-label="编程小任务">
      <header>
        <p className="eyebrow">{game.eyebrow}</p>
        <h1>{game.title}</h1>
        <p>{game.intro}</p>
      </header>
      <div className="instruction-sequence" aria-label="已经排好的步骤">
        {game.steps.map((_, index) => {
          const item = game.steps.find((step) => step.id === order[index]);
          return (
            <div className={item ? "instruction-slot filled" : "instruction-slot"} key={index}>
              <small>第 {index + 1} 步</small>
              {item
                ? <span><i>{item.emoji}</i>{item.label}</span>
                : <span className="instruction-empty">？</span>}
            </div>
          );
        })}
      </div>
      {wrong && <p className="instruction-feedback" role="alert">{game.hint || "顺序还不对，先想想第一步该做什么。"}</p>}
      {solved ? (
        <div className="instruction-success" role="status">
          <p><CheckCircle2 size={20} /> {game.successText}</p>
          <button className="button primary" type="button" onClick={onComplete}>
            {completeLabel}<Sparkles size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="instruction-pool" aria-label="待排序的步骤卡">
            {remaining.map((item) => (
              <button className="instruction-card" type="button" key={item.id} onClick={() => pick(item.id)}>
                <i>{item.emoji}</i><span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="instruction-tools">
            <button className="button secondary" type="button" disabled={!order.length} onClick={undo}>
              <Undo2 size={16} />拿回上一张
            </button>
            <button className="button ghost" type="button" disabled={!order.length} onClick={reset}>
              <RotateCcw size={16} />重新排
            </button>
          </div>
        </>
      )}
    </section>
  );
}
