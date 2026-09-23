import { ArrowLeft, ArrowRight, BookOpen, Headphones, LoaderCircle, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pictureBooksApi, speechApi } from "../api/client.js";
import { fallbackPictureBook, normalizePictureBook } from "../data/pictureBookFallback.js";

export function PictureBookReaderPage({ bookCode, navigate }) {
  const [book, setBook] = useState(() => fallbackPictureBook(bookCode));
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speechState, setSpeechState] = useState("");
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    pictureBooksApi.getPublished(bookCode)
      .then((value) => { if (active) setBook(normalizePictureBook(value)); })
      .catch(() => { if (active) setBook(fallbackPictureBook(bookCode)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; stopSpeech(); };
  }, [bookCode]);

  function stopSpeech() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeechState("");
  }

  async function readAloud(text) {
    stopSpeech();
    setSpeechState("正在准备云端语音…");
    try {
      const result = await speechApi.synthesize(text);
      const url = URL.createObjectURL(result.blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => setSpeechState("小智正在朗读");
      audio.onended = stopSpeech;
      await audio.play();
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.9;
      utterance.onend = () => setSpeechState("");
      window.speechSynthesis?.speak(utterance);
      setSpeechState("已切换浏览器朗读");
    }
  }

  function launchChallenge() {
    if (book.challengeType === "VISUAL_MISSION") {
      sessionStorage.setItem("k12-visual-mission", book.challengeReference);
      navigate("visual-code-lab");
      return;
    }
    if (book.challengeType === "CAT_LESSON") navigate("cat-lesson");
    else navigate("ai-studio");
  }

  if (loading && !book) return <div className="page page-loading"><LoaderCircle className="spin" />正在打开绘本</div>;
  if (!book?.pages?.length) return <div className="page page-loading"><p>这本绘本暂时不可用。</p><button className="button" type="button" onClick={() => navigate("picture-books")}>返回绘本馆</button></div>;
  const page = book.pages[pageIndex];
  const isLast = pageIndex === book.pages.length - 1;

  return (
    <div className="page inner-page standalone-picture-book">
      <button className="text-button" type="button" onClick={() => navigate("picture-books")}><ArrowLeft size={15} />返回绘本馆</button>
      <section className="picture-book" aria-labelledby="standalone-book-title">
        <header>
          <div><p className="eyebrow"><BookOpen size={14} />互动绘本 · {pageIndex + 1}/{book.pages.length}</p><h1 id="standalone-book-title">{book.title}</h1></div>
          <div className="speech-controls">
            <button className="button secondary" type="button" onClick={() => readAloud(page.narration)}><Volume2 size={17} />朗读这一页</button>
            <button className="icon-button" type="button" title="停止朗读" onClick={stopSpeech}><Square size={16} /></button>
          </div>
        </header>
        {speechState && <p className="speech-status"><Headphones size={15} />{speechState}</p>}
        <div className="picture-book-spread">
          <div className="picture-book-art"><img src={page.imageUrl} alt={page.altText || page.title} /></div>
          <div className="picture-book-copy"><span>第 {page.pageNo} 页</span><h2>{page.title}</h2><p>{page.narration}</p>{page.prompt && <aside>{page.prompt}</aside>}</div>
        </div>
        <footer>
          <button className="button secondary" type="button" disabled={pageIndex === 0} onClick={() => { stopSpeech(); setPageIndex((value) => value - 1); }}><ArrowLeft size={17} />上一页</button>
          {isLast ? (
            <button className="button primary" type="button" onClick={launchChallenge}>完成阅读，开始挑战<ArrowRight size={17} /></button>
          ) : (
            <button className="button primary" type="button" onClick={() => { stopSpeech(); setPageIndex((value) => value + 1); }}>下一页<ArrowRight size={17} /></button>
          )}
        </footer>
      </section>
    </div>
  );
}
