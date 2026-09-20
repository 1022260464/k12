import { ArrowLeft, Download, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { homeworksApi } from "../api/client.js";

export function StudentHomeworkPage({
  session,
  requireLogin,
  navigate,
  homeworkId,
  onStatusChange,
}) {
  const [homework, setHomework] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [texts, setTexts] = useState({});
  const [answerContent, setAnswerContent] = useState("");
  const [submission, setSubmission] = useState(null);
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setHomework(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      homeworksApi.get(homeworkId),
      homeworksApi.questions(homeworkId),
      homeworksApi.mySubmissionDetail(homeworkId).catch((requestError) => {
        if (requestError.status === 404) return null;
        throw requestError;
      }),
    ])
      .then(([item, items, detail]) => {
        if (!alive) return;
        setHomework(item);
        setQuestions(items || []);
        const current = detail?.submission || null;
        const answers = detail?.answers || [];
        setSubmission(current);
        setSubmittedAnswers(answers);
        if (current?.status === "RETURNED") {
          prefillAnswers(items || [], answers, current, setSelected, setTexts, setAnswerContent);
        } else {
          setSelected({});
          setTexts({});
          setAnswerContent("");
        }
      })
      .catch((requestError) => {
        if (alive) {
          setHomework(null);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, homeworkId]);

  const returned = submission?.status === "RETURNED";
  const canEdit = homework?.status === "PUBLISHED" && (!submission || returned);
  const viewingResult = Boolean(submission && !canEdit);

  function toggleChoice(question, key) {
    const current = selected[question.id] || [];
    const next = question.type === "MULTIPLE_CHOICE"
      ? (current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
      : [key];
    setSelected({ ...selected, [question.id]: next });
  }

  async function submit(event) {
    event.preventDefault();
    if (!homework) return;
    const answers = questions.map((question) => ({
      questionId: question.id,
      selectedAnswers: selected[question.id] || [],
      answerText: texts[question.id]?.trim() || null,
    }));
    if (questions.some((question) => (question.type === "SHORT_ANSWER"
      ? !texts[question.id]?.trim()
      : !(selected[question.id] || []).length))) {
      setError("请完成所有题目后提交");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await homeworksApi.submit(homework.id, {
        answerContent: questions.length ? null : answerContent.trim(),
        answers,
      });
      setSubmission(result);
      const detail = await homeworksApi.mySubmissionDetail(homework.id).catch(() => null);
      setSubmittedAnswers(detail?.answers || answers);
      onStatusChange?.(homework.id, detail?.submission || result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) {
    return (
      <div className="page inner-page detail-page">
        <button className="text-button detail-back" type="button" onClick={() => navigate("tasks")}>
          <ArrowLeft size={16} />返回作业练习
        </button>
        <section className="empty-state">
          <h2>登录后查看作业</h2>
          <p>作业题目与个人提交记录需要登录后读取。</p>
          <button className="button primary" type="button" onClick={() => requireLogin()}>立即登录</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page inner-page detail-page">
      <button className="text-button detail-back" type="button" onClick={() => navigate("tasks")}>
        <ArrowLeft size={16} />返回作业练习
      </button>

      {loading ? (
        <div className="loading-state"><LoaderCircle size={22} />正在加载作业</div>
      ) : !homework ? (
        <section className="empty-state">
          <h2>作业不存在或暂时无法打开</h2>
          <p>{error || "请返回作业列表重试。"}</p>
          <button className="button primary" type="button" onClick={() => navigate("tasks")}>返回作业练习</button>
        </section>
      ) : (
        <section className="detail-workspace homework-workspace">
          <header className="detail-page-head">
            <p className="eyebrow">{headerStatus(homework, submission)}</p>
            <h1>{homework.title}</h1>
            <p>{homework.description || "暂无作业说明。"}</p>
          </header>

          {submission && (
            <p className={`homework-submitted status-${submission.status?.toLowerCase()}`}>
              {submissionSummary(submission)}
            </p>
          )}
          {submission?.feedback && (
            <p className="submitted-answer">
              {returned ? "退回说明：" : "教师反馈："}{submission.feedback}
            </p>
          )}

          <form className="submission-form homework-form-wide" onSubmit={submit}>
            <h2>题目</h2>
            <div className="question-list">
              {questions.length ? questions.map((question, index) => (
                <article key={question.id}>
                  <small>第 {index + 1} 题 · {typeLabel(question.type)} · {question.score} 分</small>
                  <strong>{question.stem}</strong>
                  <QuestionAttachmentList homeworkId={homework.id} questionId={question.id} />
                  {canEdit && question.type === "SHORT_ANSWER" && (
                    <textarea
                      aria-label={`第 ${index + 1} 题答案`}
                      value={texts[question.id] || ""}
                      onChange={(event) => setTexts({ ...texts, [question.id]: event.target.value })}
                      maxLength={10000}
                      required
                    />
                  )}
                  {canEdit && ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(question.type) && (
                    (question.type === "TRUE_FALSE"
                      ? [{ key: "TRUE", content: "正确" }, { key: "FALSE", content: "错误" }]
                      : question.options || []).map((option) => (
                      <label className="question-option" key={option.key}>
                        <input
                          type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                          name={`question-${question.id}`}
                          checked={(selected[question.id] || []).includes(option.key)}
                          onChange={() => toggleChoice(question, option.key)}
                        />
                        <span>{option.content}</span>
                      </label>
                    ))
                  )}
                  {viewingResult && question.options?.map((option) => (
                    <span key={option.key}>{option.key}. {option.content}</span>
                  ))}
                  {viewingResult && (
                    <p className="submitted-answer">
                      我的答案：{formatSubmittedAnswer(submittedAnswers.find((answer) => answer.questionId === question.id))}
                    </p>
                  )}
                </article>
              )) : (
                <p className="inline-empty">本作业为文字任务，请根据说明提交学习成果。</p>
              )}
            </div>

            {canEdit && (
              <>
                {!questions.length && (
                  <label>作答内容
                    <textarea
                      value={answerContent}
                      onChange={(event) => setAnswerContent(event.target.value)}
                      placeholder="输入你的答案或解题过程"
                      maxLength={5000}
                      required
                    />
                  </label>
                )}
                <button className="button primary" type="submit" disabled={submitting}>
                  {returned ? <RotateCcw size={17} /> : <Send size={17} />}
                  {submitting ? "提交中..." : returned ? "重新提交" : "提交作业"}
                </button>
              </>
            )}
            {viewingResult && !questions.length && (
              <p className="submitted-answer">我的提交：{submission.answerContent}</p>
            )}
          </form>
          {error && <p className="page-error" role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
}

function QuestionAttachmentList({ homeworkId, questionId }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    homeworksApi.questionAttachments(homeworkId, questionId)
      .then((value) => { if (alive) setItems(value || []); })
      .catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [homeworkId, questionId]);

  async function download(item) {
    try {
      const { url } = await homeworksApi.questionAttachmentUrl(homeworkId, questionId, item.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (failure) {
      setError(failure.message);
    }
  }

  if (!items.length && !error) return null;
  return (
    <div className="question-attachments">
      {items.map((item) => (
        <button className="text-button" type="button" key={item.id} onClick={() => download(item)}>
          <Download size={15} />
          {item.filename}
          {item.sizeBytes != null ? ` · ${Math.ceil(item.sizeBytes / 1024)} KB` : ""}
        </button>
      ))}
      {error && <p className="page-error" role="alert">{error}</p>}
    </div>
  );
}

function prefillAnswers(questions, answers, submission, setSelected, setTexts, setAnswerContent) {
  const nextSelected = {};
  const nextTexts = {};
  answers.forEach((answer) => {
    if (answer.selectedAnswers?.length) nextSelected[answer.questionId] = answer.selectedAnswers;
    if (answer.answerText) nextTexts[answer.questionId] = answer.answerText;
  });
  setSelected(nextSelected);
  setTexts(nextTexts);
  if (!questions.length && submission?.answerContent && submission.answerContent !== "[STRUCTURED_ANSWERS]") {
    setAnswerContent(submission.answerContent);
  }
}

function headerStatus(homework, submission) {
  if (!submission) return homework.status === "CLOSED" ? "已结束" : "待完成";
  return submissionStatusLabel(submission.status);
}

function submissionSummary(submission) {
  const label = submissionStatusLabel(submission.status);
  if (submission.status === "GRADED") {
    return submission.score != null ? `${label} · ${submission.score} 分` : label;
  }
  if (submission.status === "RETURNED") return `${label} · 请修改后重新提交`;
  if (submission.status === "PENDING_GRADING") return `${label} · 等待教师批改`;
  return `${label} · 等待批改`;
}

function submissionStatusLabel(status) {
  return ({
    SUBMITTED: "已提交",
    PENDING_GRADING: "已提交",
    GRADED: "已完成",
    RETURNED: "可重新提交",
  })[status] || "处理中";
}

function typeLabel(type) {
  return ({
    SHORT_ANSWER: "简答题",
    SINGLE_CHOICE: "单选题",
    MULTIPLE_CHOICE: "多选题",
    TRUE_FALSE: "判断题",
  })[type] || type;
}

function formatSubmittedAnswer(answer) {
  if (!answer) return "正在读取";
  if (answer.answerText) return answer.answerText;
  return answer.selectedAnswers
    ?.map((value) => (value === "TRUE" ? "正确" : value === "FALSE" ? "错误" : value))
    .join("、") || "未作答";
}
