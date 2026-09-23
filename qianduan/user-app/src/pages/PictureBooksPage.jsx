import { ArrowRight, BookOpen, Headphones, Images, Sparkles } from "lucide-react";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { useEffect, useState } from "react";
import { pictureBooksApi } from "../api/client.js";
import { fallbackPictureBooks, normalizePictureBook } from "../data/pictureBookFallback.js";
import { EXPERIENCE } from "../experience/experience.js";

export function PictureBooksPage({ session, requireLogin, navigate }) {
  const [books, setBooks] = useState(fallbackPictureBooks);

  useEffect(() => {
    let active = true;
    pictureBooksApi.published()
      .then((items) => {
        if (active && Array.isArray(items) && items.length) setBooks(items.map(normalizePictureBook));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function openBook(book) {
    requireLogin(() => navigate(book.challengeType === "CAT_LESSON"
      ? "cat-lesson"
      : `picture-books/${book.bookCode}`));
  }

  return (
    <div className="page inner-page picture-books-page">
      <ExperiencePageHeader
        experience={EXPERIENCE.PRIMARY}
        eyebrow="小智互动绘本"
        title="把 AI 知识装进故事里"
        description="每本绘本都有语音朗读、图文讲解和一个可以动手完成的小挑战。"
        imageKey="reading"
      />

      <section className="picture-book-library" aria-labelledby="picture-book-library-title">
        <header>
          <div>
            <p className="eyebrow"><Sparkles size={14} /> 本周精选</p>
            <h2 id="picture-book-library-title">选择今天的 AI 绘本</h2>
          </div>
          <span><BookOpen size={17} /> 适合小学低年级</span>
        </header>

        <div className="picture-book-grid">
          {books.map((book) => (
            <article className="picture-book-card" key={book.bookCode}>
              <img src={book.coverUrl || book.pages?.[0]?.imageUrl || "/assets/experience/primary/student-reading.webp"} alt={book.title} />
              <div>
                <small>{book.subtitle || "人工智能通识 · 互动绘本"}</small>
                <h3>{book.title}</h3>
                <p>{book.summary}</p>
                <ul>
                  <li><Headphones size={15} />语音朗读与文字讲解</li>
                  <li><Images size={15} />{book.pages?.length || 0} 页审定故事</li>
                  <li><Sparkles size={15} />读完进入互动挑战</li>
                </ul>
                <button className="button primary" type="button" onClick={() => openBook(book)}>
                  {session ? "开始阅读" : "登录后开始"}<ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
