import { ArrowRight, BookOpen, Headphones, Images, Sparkles } from "lucide-react";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { useEffect, useMemo, useState } from "react";
import { pictureBooksApi } from "../api/client.js";
import { extraFallbackBooks, fallbackPictureBooks, normalizePictureBook } from "../data/pictureBookFallback.js";
import { EXPERIENCE } from "../experience/experience.js";

const STAGE_GROUPS = [
  {
    stage: "PRIMARY_LOWER",
    title: "小学低年级 · 一起听故事",
    hint: "低年级",
    note: "字少图多，点小喇叭让小智读给你听。",
  },
  {
    stage: "PRIMARY_UPPER",
    title: "小学高年级 · 进阶绘本",
    hint: "高年级",
    note: "读完可以接着去挑战和实验。",
  },
];

export function PictureBooksPage({
  session,
  requireLogin,
  navigate,
  experience = EXPERIENCE.PRIMARY,
  learningProfile,
}) {
  const [books, setBooks] = useState(() => [...fallbackPictureBooks, ...extraFallbackBooks]);

  useEffect(() => {
    let active = true;
    pictureBooksApi.published()
      .then((items) => {
        if (active && Array.isArray(items) && items.length) setBooks(items.map(normalizePictureBook));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const stageGroups = useMemo(() => {
    const profileStage = learningProfile?.schoolStage;
    const currentStage = profileStage === "PRIMARY_LOWER" || profileStage === "PRIMARY_UPPER"
      ? profileStage
      : null;
    return STAGE_GROUPS
      .filter((group) => !currentStage || group.stage === currentStage)
      .map((group) => ({
        ...group,
        books: books.filter((book) => (book.stageCode || book.stage_code) === group.stage),
      }))
      .filter((group) => group.books.length);
  }, [books, learningProfile?.schoolStage]);

  function openBook(book) {
    requireLogin(() => navigate(book.challengeType === "CAT_LESSON"
      ? "cat-lesson"
      : `picture-books/${book.bookCode}`));
  }

  return (
    <div className="page inner-page picture-books-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow="小智互动绘本"
        title="看图画，听故事，学 AI"
        description="翻开绘本，让小智读给你听；读完还有一个小挑战等着你。"
        imageKey="reading"
      />

      {stageGroups.map((group) => (
        <section className="picture-book-library" aria-labelledby={`picture-book-title-${group.stage}`} key={group.stage}>
          <header>
            <div>
              <p className="eyebrow"><Sparkles size={14} />{group.hint}</p>
              <h2 id={`picture-book-title-${group.stage}`}>{group.title}</h2>
              <p className="picture-book-group-note">{group.note}</p>
            </div>
            <span><BookOpen size={17} />{group.books.length} 本</span>
          </header>

          <div className="picture-book-grid">
            {group.books.map((book) => (
              <article className="picture-book-card" key={book.bookCode}>
                <button className="picture-book-cover" type="button" onClick={() => openBook(book)} aria-label={`翻开绘本${book.title}`}>
                  <img src={book.coverUrl || book.pages?.[0]?.imageUrl || "/assets/experience/primary/student-reading.webp"} alt={book.title} loading="lazy" />
                  <span className="picture-book-cover-hint"><Headphones size={16} />翻开听故事</span>
                </button>
                <div className="picture-book-copy">
                  <h3>{book.title}</h3>
                  <small>{book.subtitle || "人工智能通识 · 互动绘本"}</small>
                  <p>{book.summary}</p>
                  <div className="picture-book-facts">
                    <span><Images size={14} />{book.pages?.length || 0} 页</span>
                    <span><Headphones size={14} />小智朗读</span>
                  </div>
                  <button className="button primary" type="button" onClick={() => openBook(book)}>
                    {session ? "开始阅读" : "登录后开始"}<ArrowRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
