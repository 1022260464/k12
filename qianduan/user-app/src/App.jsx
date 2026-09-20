import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getStoredSession, login, logout, register } from "./api/auth.js";
import { FloatingAssistant } from "./components/FloatingAssistant.jsx";
import { ProfileSettingsModal } from "./components/ProfileSettingsModal.jsx";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { AiStudioPage } from "./pages/AiStudioPage.jsx";
import { CodeLabPage } from "./pages/CodeLabPage.jsx";
import { CourseDetailPage } from "./pages/CourseDetailPage.jsx";
import { CoursesPage } from "./pages/CoursesPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LeaderboardPage } from "./pages/LeaderboardPage.jsx";
import { ProgressPage } from "./pages/ProgressPage.jsx";
import { StudentHomeworkPage } from "./pages/StudentHomeworkPage.jsx";
import { TasksPage } from "./pages/TasksPage.jsx";
import { AUTH_STORAGE_KEY, profileApi } from "./api/client.js";
import {
  PASSWORD_RULES_TEXT,
  USERNAME_RULES_TEXT,
  mapUniqueIdentityError,
  passwordStrength,
  validateRegisterForm,
} from "./utils/passwordValidation.js";

const listPages = new Set(["home", "ai-studio", "courses", "tasks", "code-lab", "leaderboard", "progress"]);

function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "home";
  const parts = raw.split("/").filter(Boolean);
  const root = parts[0] || "home";

  if (root === "courses" && parts[1]) {
    const chapterId = parts[2] === "chapters" && parts[3] ? parts[3] : null;
    return {
      page: "course-detail",
      nav: "courses",
      courseId: parts[1],
      chapterId,
    };
  }
  if (root === "tasks" && parts[1]) {
    return {
      page: "task-detail",
      nav: "tasks",
      homeworkId: parts[1],
    };
  }
  if (root === "profile") {
    return { page: "home", nav: "home", courseId: null, chapterId: null, homeworkId: null, openProfile: true };
  }
  if (listPages.has(root)) {
    return { page: root, nav: root, courseId: null, chapterId: null, homeworkId: null };
  }
  return { page: "home", nav: "home", courseId: null, chapterId: null, homeworkId: null };
}

function AuthDialog({ initialMode = "login", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: "", password: "", nickname: "", email: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ username: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: "" }));
    }
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({ username: "", email: "" });
    try {
      if (mode === "register") {
        const validationError = validateRegisterForm(form);
        if (validationError) {
          if (validationError.includes("用户名") || validationError.includes("账号")) {
            setFieldErrors({ username: validationError, email: "" });
          } else if (validationError.includes("邮箱")) {
            setFieldErrors({ username: "", email: validationError });
          } else {
            setError(validationError);
          }
          setSubmitting(false);
          return;
        }
        await register({
          username: form.username.trim(),
          password: form.password,
          nickname: form.nickname.trim(),
          email: form.email.trim() || null,
        });
      }
      onSuccess(await login(form.username.trim(), form.password));
    } catch (authError) {
      if (mode === "register") {
        const mapped = mapUniqueIdentityError(authError.message);
        setFieldErrors(mapped.fields);
        setError(mapped.form);
      } else {
        setError(authError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog-close" type="button" title="关闭" onClick={onClose}><X size={19} /></button>
        <div className="dialog-brand"><span className="brand-mark"><img src="/assets/brand-face-doodle.png" alt="" /></span></div>
        <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建学习账号"}</p>
        <h2 id="login-title">{mode === "login" ? "登录学习空间" : "注册学生账号"}</h2>
        <p className="dialog-note">
          {mode === "login"
            ? "登录后同步课程、作业和学习记录。"
            : `${USERNAME_RULES_TEXT}；${PASSWORD_RULES_TEXT}。`}
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            用户名
            <input
              autoFocus
              value={form.username}
              minLength={mode === "register" ? 4 : undefined}
              maxLength={32}
              pattern={mode === "register" ? "[A-Za-z][A-Za-z0-9_]{3,31}" : undefined}
              title={USERNAME_RULES_TEXT}
              aria-invalid={Boolean(fieldErrors.username)}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder={mode === "register" ? "例如：student01" : "请输入用户名"}
              required
            />
            {fieldErrors.username && <small className="field-error" role="alert">{fieldErrors.username}</small>}
          </label>
          {mode === "register" && (
            <label>
              姓名或昵称
              <input
                value={form.nickname}
                maxLength={64}
                onChange={(event) => updateField("nickname", event.target.value)}
                placeholder="例如：小明"
                required
              />
            </label>
          )}
          {mode === "register" && (
            <label>
              邮箱（选填）
              <input
                type="email"
                value={form.email}
                maxLength={128}
                aria-invalid={Boolean(fieldErrors.email)}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
              />
              {fieldErrors.email && <small className="field-error" role="alert">{fieldErrors.email}</small>}
            </label>
          )}
          <label>
            密码
            <input
              type="password"
              value={form.password}
              minLength={mode === "register" ? 8 : undefined}
              maxLength={72}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder={mode === "register" ? "至少8位，含字母和数字" : "请输入密码"}
              required
            />
          </label>
          {mode === "register" && (
            <ul className="password-checklist auth-checklist" aria-label="注册要求">
              <li className={/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(form.username.trim()) ? "ok" : ""}>账号合法</li>
              <li className={passwordStrength(form.password).lengthOk ? "ok" : ""}>密码 8–72 位</li>
              <li className={passwordStrength(form.password).hasLetter ? "ok" : ""}>含字母</li>
              <li className={passwordStrength(form.password).hasDigit ? "ok" : ""}>含数字</li>
            </ul>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={submitting}>
            {submitting ? "正在提交..." : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>
        <button
          className="account-switch"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setFieldErrors({ username: "", email: "" });
          }}
        >
          {mode === "login" ? "没有账号？注册学生账号" : "已有账号？返回登录"}
        </button>
      </section>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(getStoredSession);
  const [route, setRoute] = useState(parseRoute);
  const [assistantDraft, setAssistantDraft] = useState(null);
  const [practiceRevision, setPracticeRevision] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const displayName = useMemo(
    () => profile?.nickname || session?.user?.username || "同学",
    [profile, session],
  );

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!route.openProfile) return;
    if (session) setShowProfile(true);
    else {
      setAuthMode("login");
      setShowLogin(true);
    }
    if (window.location.hash === "#profile" || window.location.hash === "#/profile") {
      window.location.hash = "#home";
    }
  }, [route.openProfile, session]);

  // 新标签页与当前页共用 localStorage 令牌；其它标签登录/退出时同步 UI
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== AUTH_STORAGE_KEY) return;
      setSession(getStoredSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setShowProfile(false);
      return undefined;
    }
    let alive = true;
    profileApi.me()
      .then((data) => { if (alive) setProfile(data); })
      .catch(() => { if (alive) setProfile(null); });
    return () => { alive = false; };
  }, [session]);

  function navigate(nextPage) {
    window.location.hash = `#${nextPage}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setShowLogin(true);
  }

  function openProfile() {
    if (!session) {
      openAuth("login");
      return;
    }
    setShowProfile(true);
  }

  function requireLogin(action) {
    if (session) action?.();
    else openAuth("login");
  }

  let content = null;
  if (route.page === "course-detail") {
    content = (
      <CourseDetailPage
        session={session}
        requireLogin={requireLogin}
        navigate={navigate}
        courseId={route.courseId}
        chapterId={route.chapterId}
      />
    );
  } else if (route.page === "task-detail") {
    content = (
      <StudentHomeworkPage
        session={session}
        requireLogin={requireLogin}
        navigate={navigate}
        homeworkId={route.homeworkId}
      />
    );
  } else {
    const pages = {
      home: <HomePage session={session} displayName={displayName} navigate={navigate} requireLogin={requireLogin} />,
      "ai-studio": (
        <AiStudioPage
          session={session}
          displayName={displayName}
          requireLogin={requireLogin}
          navigate={navigate}
          draftRequest={assistantDraft}
          onDraftConsumed={() => setAssistantDraft(null)}
          onPracticeRecorded={() => setPracticeRevision((value) => value + 1)}
        />
      ),
      courses: <CoursesPage session={session} requireLogin={requireLogin} navigate={navigate} />,
      tasks: <TasksPage session={session} requireLogin={requireLogin} navigate={navigate} />,
      "code-lab": <CodeLabPage session={session} requireLogin={requireLogin} />,
      leaderboard: <LeaderboardPage session={session} requireLogin={requireLogin} />,
      progress: (
        <ProgressPage
          session={session}
          requireLogin={requireLogin}
          navigate={navigate}
          onOpenProfile={openProfile}
          onPractice={(topic) => {
            setAssistantDraft({ topic });
            requireLogin(() => navigate("ai-studio"));
          }}
          practiceRevision={practiceRevision}
        />
      ),
    };
    content = pages[route.page];
  }

  return (
    <main>
      <SiteHeader
        page={route.nav}
        session={session}
        displayName={displayName}
        avatarUrl={profile?.avatarUrl}
        navigate={navigate}
        requireLogin={requireLogin}
        onAskKnowledge={(point) => {
          const title = point?.title || point?.code || "该知识点";
          setAssistantDraft({
            prompt: `请讲解知识点「${title}」${point?.code ? `（${point.code}）` : ""}，用适合我学段的例子说明，并给我一道小练习。`,
            preferDeterministic: false,
          });
          requireLogin(() => navigate("ai-studio"));
        }}
        onOpenProfile={openProfile}
        onLogin={() => openAuth("login")}
        onRegister={() => openAuth("register")}
        onLogout={() => { logout(); setAssistantDraft(null); setProfile(null); setShowProfile(false); setSession(null); }}
      />
      {content}
      <footer className="site-footer">
        <button className="brand brand-button" type="button" onClick={() => navigate("home")}>
          <span className="brand-mark"><img src="/assets/brand-face-doodle.png" alt="" /></span><span>EduGraph AI</span>
        </button>
        <p>面向 K12 的多智能体教学平台</p>
        <span>© 2026 K12 Platform</span>
      </footer>
      <FloatingAssistant page={route.page} session={session} navigate={navigate} onRequireLogin={() => openAuth("login")} />
      {showLogin && (
        <AuthDialog
          initialMode={authMode}
          onClose={() => setShowLogin(false)}
          onSuccess={(nextSession) => { setSession(nextSession); setShowLogin(false); }}
        />
      )}
      {showProfile && session && (
        <ProfileSettingsModal
          session={session}
          onClose={() => setShowProfile(false)}
          onProfileUpdated={(data) => setProfile(data)}
        />
      )}
    </main>
  );
}
