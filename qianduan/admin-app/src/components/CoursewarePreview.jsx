import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

/** 管理端课件预览：与学生端播放器同一份 JSON 协议，只读、不朗读。 */
export function CoursewarePreview({ document: doc }) {
  const slides = doc?.slides || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  if (!slides.length) return <div className="admin-empty">课件内容为空</div>;
  const slide = slides[Math.min(index, slides.length - 1)];

  function pick(optionIndex) {
    setAnswers((current) => ({ ...current, [index]: optionIndex }));
  }

  return (
    <div className="courseware-preview">
      <header className="courseware-preview-head">
        <strong>{doc.title}</strong>
        <span>{index + 1} / {slides.length}</span>
      </header>
      <div className="courseware-preview-body">
        {slide.type === "cover" && (
          <div className="preview-cover">
            <h2>{slide.title}</h2>
            {slide.subtitle && <p>{slide.subtitle}</p>}
          </div>
        )}
        {slide.type !== "cover" && <h3>{slide.title}</h3>}
        {Array.isArray(slide.bullets) && slide.bullets.length > 0 && (
          <ul>{slide.bullets.map((bullet, i) => <li key={i}>{bullet}</li>)}</ul>
        )}
        {slide.content && <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.content}</ReactMarkdown>}
        {slide.type === "quiz" && Array.isArray(slide.options) && (
          <div className="preview-quiz">
            {slide.options.map((option, i) => (
              <button
                key={i}
                type="button"
                className={answers[index] === i ? (i === slide.answer ? "right" : "wrong") : ""}
                onClick={() => pick(i)}
              >
                {OPTION_LABELS[i]}. {option}
              </button>
            ))}
            {answers[index] !== undefined && (
              <p className="preview-answer">
                {answers[index] === slide.answer ? "答对啦！" : "再想想～"}
                {slide.explanation ? ` ${slide.explanation}` : ""}
              </p>
            )}
          </div>
        )}
        {Array.isArray(slide.points) && (
          <ul>{slide.points.map((point, i) => <li key={i}>{point}</li>)}</ul>
        )}
      </div>
      <footer className="courseware-preview-nav">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <ChevronLeft size={14} /> 上一页
        </button>
        <span>{slides.map((_, i) => <i key={i} className={i === index ? "on" : ""} />)}</span>
        <button type="button" disabled={index >= slides.length - 1} onClick={() => setIndex(index + 1)}>
          下一页 <ChevronRight size={14} />
        </button>
      </footer>
    </div>
  );
}
