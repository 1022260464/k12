import {
  ArrowLeft,
  ArrowRight,
  Headphones,
  LoaderCircle,
  Square,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { speechApi } from "../api/client.js";
import { COURSEWARE_MIME } from "../data/coursewareFallback.js";
import { MarkdownContent } from "./MarkdownContent.jsx";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export function CoursewarePlayer({ courseware }) {
  const slides = courseware?.document?.slides || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [speaking, setSpeaking] = useState(false);
  const [preparingSpeech, setPreparingSpeech] = useState(false);
  const [speechError, setSpeechError] = useState(false);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const slide = slides[Math.min(index, slides.length - 1)];

  function stopSpeech() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  useEffect(() => {
    stopSpeech();
    setSpeechError(false);
  }, [index]);

  useEffect(() => () => stopSpeech(), []);

  if (!courseware?.document?.slides?.length) return null;
  const narration = slide.narration
    || slide.bullets?.join("。")
    || slide.points?.join("。")
    || [slide.title, slide.subtitle].filter(Boolean).join("，");

  async function speak(text) {
    if (!text) return;
    if (speaking) {
      stopSpeech();
      return;
    }
    setPreparingSpeech(true);
    setSpeechError(false);
    try {
      const audioResult = await speechApi.synthesize(String(text).slice(0, 800));
      const url = URL.createObjectURL(audioResult.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => setSpeaking(true);
      audio.onended = stopSpeech;
      await audio.play();
    } catch {
      if (!("speechSynthesis" in window)) {
        setSpeechError(true);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(String(text).slice(0, 800));
      utterance.lang = "zh-CN";
      utterance.rate = 0.92;
      utterance.onend = stopSpeech;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    } finally {
      setPreparingSpeech(false);
    }
  }

  const selectedAnswer = answers[index];
  return (
    <div className="courseware-player" data-testid="courseware-player">
      <header className="courseware-head">
        <span className="courseware-badge">AI 课件</span>
        <strong>{courseware.title || courseware.document.title}</strong>
        <span className="courseware-page">{index + 1}/{slides.length}</span>
      </header>
      {courseware.localDemo && <p className="courseware-demo-note">本机演示课件 · 服务端课件接口接通后会自动切换</p>}

      <div className={`courseware-slide slide-${slide.type}`}>
        {slide.type === "cover" && (
          <div className="courseware-cover">
            <h3>{slide.title}</h3>
            {slide.subtitle && <p>{slide.subtitle}</p>}
            <button className="courseware-start" type="button" onClick={() => setIndex(1)}>开始学习</button>
          </div>
        )}

        {slide.type === "concept" && (
          <div>
            <h4>{slide.title}</h4>
            <ul className="courseware-bullets">{(slide.bullets || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}

        {slide.type === "example" && (
          <div>
            {slide.title && <h4>{slide.title}</h4>}
            <MarkdownContent className="courseware-md">{slide.body || ""}</MarkdownContent>
          </div>
        )}

        {slide.type === "quiz" && (
          <div>
            <h4>{slide.question}</h4>
            <div className="courseware-options">
              {(slide.options || []).map((option, optionIndex) => {
                const picked = selectedAnswer === optionIndex;
                const correct = slide.answer === optionIndex;
                const tone = selectedAnswer == null ? "" : correct ? " right" : picked ? " wrong" : "";
                return (
                  <button
                    className={`courseware-option${tone}`}
                    type="button"
                    disabled={selectedAnswer != null}
                    key={option}
                    onClick={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))}
                  >
                    <b>{OPTION_LABELS[optionIndex]}</b> {option}
                  </button>
                );
              })}
            </div>
            {selectedAnswer != null && slide.explanation && (
              <p className={selectedAnswer === slide.answer ? "courseware-right" : "courseware-wrong"}>
                {selectedAnswer === slide.answer ? "答对啦！" : "再看看这个提示："}{slide.explanation}
              </p>
            )}
          </div>
        )}

        {slide.type === "summary" && (
          <div>
            {slide.title && <h4>{slide.title}</h4>}
            <ul className="courseware-bullets">{(slide.points || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}

        {slide.type !== "quiz" && narration && (
          <div className="courseware-speak-wrap">
            <button className={`courseware-speak${speaking ? " speaking" : ""}`} type="button" disabled={preparingSpeech} onClick={() => speak(narration)}>
              {preparingSpeech ? <LoaderCircle className="spin" size={13} /> : speaking ? <Square size={13} /> : <Volume2 size={14} />}
              {preparingSpeech ? "小智准备中…" : speaking ? "停止朗读" : "读给我听"}
            </button>
            {speechError && <span className="courseware-speak-error"><Headphones size={13} />朗读暂时不可用，稍后再试</span>}
          </div>
        )}
      </div>

      <footer className="courseware-nav">
        <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft size={14} /> 上一页</button>
        <span className="courseware-dots">
          {slides.map((item, slideIndex) => (
            <i
              className={slideIndex === index ? "on" : ""}
              role="button"
              tabIndex={0}
              title={`第 ${slideIndex + 1} 页`}
              key={`${item.type}-${slideIndex}`}
              onClick={() => setIndex(slideIndex)}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setIndex(slideIndex)}
            />
          ))}
        </span>
        <button type="button" disabled={index >= slides.length - 1} onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}>下一页 <ArrowRight size={14} /></button>
      </footer>
    </div>
  );
}
