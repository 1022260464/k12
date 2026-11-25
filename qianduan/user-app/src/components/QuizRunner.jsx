import { CheckCircle2, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { quizApi } from "../api/client.js";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];
const STAGES = new Set(["lower_primary", "upper_primary", "middle_school", "high_school"]);

/**
 * AI 组题练习卡：按主题/课文即时出一组选择题，逐题作答、即时批改。
 * 三处入口：课程随堂练习「做一做」、趣味任务「AI 出题挑战」、作业练习「AI 组题」。
 */
export function QuizRunner({
  topic,
  stage = "lower_primary",
  sourceText,
  count = 5,
  title = "随堂练习 · 做一做",
  subtitle,
  cta = "开始答题",
  variant = "inline",
}) {
  const [doc, setDoc] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const result = await quizApi.generate({
        topic,
        stage: STAGES.has(stage) ? stage : "lower_primary",
        count,
        sourceText,
      });
      const questions = (result?.questions || []).filter(
        (item) => item?.stem && Array.isArray(item?.options) && item.options.length >= 2,
      );
      if (!questions.length) throw new Error("小智没出出来题，再试一次吧");
      setDoc({ title: result?.title || topic, questions });
      setIndex(0);
      setPicked(null);
      setAnswers([]);
      setFinished(false);
    } catch (requestError) {
      setError(requestError.message || "出题失败了，稍后再试");
    } finally {
      setLoading(false);
    }
  }

  function pick(optionIndex) {
    if (picked !== null) return;
    setPicked(optionIndex);
    setAnswers((current) => {
      const next = [...current];
      next[index] = optionIndex;
      return next;
    });
  }

  function next() {
    if (index + 1 >= doc.questions.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  }

  function restart() {
    setDoc(null);
    setFinished(false);
    setIndex(0);
    setPicked(null);
    setAnswers([]);
  }

  const score = doc
    ? doc.questions.reduce((sum, question, i) => sum + (answers[i] === question.answer ? 1 : 0), 0)
    : 0;

  return (
    <section className={`quiz-runner quiz-${variant}`} data-testid="quiz-runner">
      <header className="quiz-runner-head">
        <span className="quiz-runner-badge"><Sparkles size={12} />AI 出题</span>
        <strong>{doc?.title || title}</strong>
      </header>
      {subtitle && !doc && <p className="quiz-runner-sub">{subtitle}</p>}

      {!doc && !loading && (
        <div className="quiz-runner-start">
          <button className="button primary" type="button" onClick={generate}>{cta}</button>
          {error && <p className="quiz-runner-error">{error}</p>}
        </div>
      )}

      {loading && (
        <p className="quiz-runner-loading"><LoaderCircle className="spin" size={16} />小智正在出题，马上就好…</p>
      )}

      {doc && !finished && (
        <div className="quiz-runner-body">
          <p className="quiz-runner-progress">第 {index + 1}/{doc.questions.length} 题</p>
          <h4 className="quiz-runner-stem">{doc.questions[index].stem}</h4>
          <div className="quiz-runner-options">
            {doc.questions[index].options.map((option, i) => {
              const isAnswer = i === doc.questions[index].answer;
              const chosen = picked === i;
              const state = picked === null ? "" : isAnswer ? " right" : chosen ? " wrong" : "";
              return (
                <button
                  key={i}
                  type="button"
                  className={`quiz-runner-option${state}`}
                  disabled={picked !== null}
                  onClick={() => pick(i)}
                >
                  <b>{OPTION_LABELS[i]}</b>
                  <span>{option}</span>
                  {picked !== null && isAnswer && <CheckCircle2 size={15} className="quiz-mark" />}
                  {picked !== null && chosen && !isAnswer && <XCircle size={15} className="quiz-mark" />}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="quiz-runner-explain">
              <p className={picked === doc.questions[index].answer ? "quiz-right" : "quiz-wrong"}>
                {picked === doc.questions[index].answer ? "答对啦，真棒！" : "没关系，看看为什么："}
              </p>
              {doc.questions[index].explanation && <p>{doc.questions[index].explanation}</p>}
              <button className="button primary compact" type="button" onClick={next}>
                {index + 1 >= doc.questions.length ? "看成绩" : "下一题"}
              </button>
            </div>
          )}
        </div>
      )}

      {doc && finished && (
        <div className="quiz-runner-result">
          <p className="quiz-runner-score">{score} / {doc.questions.length}</p>
          <p className="quiz-runner-praise">
            {score === doc.questions.length ? "全对！你太厉害啦！"
              : score >= doc.questions.length / 2 ? "很不错！错题再想一想。"
                : "别灰心，再练一组就更熟啦！"}
          </p>
          <div className="quiz-runner-actions">
            <button className="button primary compact" type="button" onClick={generate}>再练一组</button>
            <button className="button secondary compact" type="button" onClick={restart}>换个玩法</button>
          </div>
        </div>
      )}
    </section>
  );
}
