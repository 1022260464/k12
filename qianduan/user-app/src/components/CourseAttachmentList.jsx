import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { coursesApi, teachingResourcesApi } from "../api/client.js";

export function CourseAttachmentList({ courseId, chapterId = null }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const request = chapterId ? coursesApi.chapterAttachments(courseId, chapterId) : coursesApi.attachments(courseId);
    request.then((value) => {
      if (alive) {
        setItems(value || []);
        setError("");
      }
    }).catch((failure) => {
      // 附件为可选能力：403/404/空库都不阻断阅读主路径
      if (alive) {
        setItems([]);
        if (failure.status && failure.status >= 500) setError("教学附件暂时无法加载");
        else setError("");
      }
    });
    return () => { alive = false; };
  }, [courseId, chapterId]);
  async function download(id) {
    try {
      const { url } = await teachingResourcesApi.publishedDownload(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (failure) { setError(failure.message); }
  }
  if (!items.length && !error) return null;
  return <section className="lesson-attachments"><h4>教学附件</h4>{items.map((item) => <button className="text-button" type="button" key={item.id} onClick={() => download(item.id)}><Download size={15} />{item.title} · {item.originalFilename}</button>)}{error && <p className="page-error" role="alert">{error}</p>}</section>;
}
