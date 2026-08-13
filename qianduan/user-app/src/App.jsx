import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  GraduationCap,
  LogOut,
  Menu,
  MessageSquareText,
  Play,
  Route,
  Search,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { getStoredSession, login, logout, register } from "./api/auth.js";

const courses = [
  { title: "Python 程序设计", subject: "信息科技", progress: 72, next: "循环结构与列表", tone: "cyan", icon: Code2 },
  { title: "七年级数学", subject: "数学", progress: 46, next: "一元一次方程", tone: "yellow", icon: Target },
  { title: "科学探究实验", subject: "科学", progress: 31, next: "控制变量法", tone: "pink", icon: BookOpen },
];

const learningPath = [
  { title: "理解变量与数据类型", meta: "已掌握 · 18 分钟", done: true },
  { title: "完成条件判断练习", meta: "进行中 · 6/10 题", active: true },
  { title: "挑战循环结构项目", meta: "预计 35 分钟" },
];

function AuthDialog({ initialMode = "login", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        await register({
          username: form.username.trim(),
          password: form.password,
          nickname: form.nickname.trim(),
          email: form.email.trim() || null,
        });
      }
      const session = await login(form.username.trim(), form.password);
      onSuccess(session);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog-close" type="button" title="关闭" onClick={onClose}><X size={20} /></button>
        <div className="dialog-brand"><span>eg</span></div>
        <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建学习账号"}</p>
        <h2 id="login-title">{mode === "login" ? "登录学习空间" : "注册学生账号"}</h2>
        <p className="dialog-note">{mode === "login" ? "使用学校分配或自行注册的账号继续学习。" : "新账号将自动获得学生角色。"}</p>
        <form onSubmit={handleSubmit}>
          <label>用户名<input autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="请输入用户名" required /></label>
          {mode === "register" && <label>姓名或昵称<input value={form.nickname || ""} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如：小明" required /></label>}
          {mode === "register" && <label>邮箱（选填）<input type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></label>}
          <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="请输入密码" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full" type="submit" disabled={submitting}>{submitting ? "正在提交..." : mode === "login" ? "登录" : "注册并登录"}</button>
        </form>
        <button className="account-switch" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "没有账号？注册学生账号" : "已有账号？返回登录"}</button>
      </section>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(getStoredSession);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = useMemo(() => session?.user?.username ?? "同学", [session]);

  function handleLogout() {
    logout();
    setSession(null);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="EduGraph AI 首页"><span className="brand-mark">eg</span><span>EduGraph AI</span></a>
        <nav className={menuOpen ? "open" : ""} aria-label="主导航">
          <a href="#courses">我的课程</a><a href="#path">学习路径</a><a href="#assistant">AI 助教</a>
        </nav>
        <div className="header-actions">
          <label className="header-search"><Search size={18} /><input aria-label="搜索课程" placeholder="搜索课程和知识点" /></label>
          {session ? (
            <div className="user-menu"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span>{displayName}</span><button className="icon-button" type="button" title="退出登录" onClick={handleLogout}><LogOut size={18} /></button></div>
          ) : <><button className="header-register" type="button" onClick={() => { setAuthMode("register"); setShowLogin(true); }}>注册</button><button className="primary-button compact" type="button" onClick={() => { setAuthMode("login"); setShowLogin(true); }}>登录</button></>}
          <button className="icon-button mobile-menu" type="button" title="菜单" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={16} /> 今日学习计划已生成</p>
          <h1>{session ? `${displayName}，继续你的学习旅程` : "每一次学习，都有 AI 在身边"}</h1>
          <p>从知识讲解、互动练习到个性化诊断，智能助教会根据你的掌握情况安排下一步。</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => session ? document.querySelector("#path")?.scrollIntoView() : setShowLogin(true)}><Play size={18} />{session ? "继续学习" : "进入学习空间"}</button>
            <a className="text-link" href="#assistant">认识 AI 助教<ArrowRight size={17} /></a>
          </div>
          <div className="today-summary"><div><strong>42</strong><span>今日学习分钟</span></div><div><strong>6</strong><span>完成练习</span></div><div><strong>84%</strong><span>知识掌握度</span></div></div>
        </div>
        <div className="hero-visual"><img src="/assets/k12-ai-learning-journey.png" alt="学生使用人工智能进行个性化学习" /><div className="floating-status"><CheckCircle2 size={18} /><span>本周目标已完成 4/6</span></div></div>
      </section>

      <section className="content-section" id="courses">
        <div className="section-heading"><div><p className="eyebrow">我的课程</p><h2>从上次离开的地方继续</h2></div><button className="text-link" type="button">查看全部<ChevronRight size={18} /></button></div>
        <div className="course-grid">{courses.map(({ icon: Icon, ...course }) => <article className={`course-card ${course.tone}`} key={course.title}><div className="course-icon"><Icon size={24} /></div><span className="subject-tag">{course.subject}</span><h3>{course.title}</h3><p>下一节：{course.next}</p><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div><div className="progress-meta"><span>{course.progress}%</span><button className="icon-button" type="button" title={`继续学习 ${course.title}`}><ArrowRight size={18} /></button></div></article>)}</div>
      </section>

      <section className="learning-band" id="path">
        <div className="path-copy"><p className="eyebrow">个性化路径</p><h2>你的下一步，来自真实学习表现</h2><p>系统根据练习正确率、思考时间和常见错误持续调整任务难度。</p><div className="path-list">{learningPath.map((item, index) => <div className={`path-item ${item.done ? "done" : ""} ${item.active ? "active" : ""}`} key={item.title}><span>{item.done ? <CheckCircle2 size={20} /> : index + 1}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div></div>)}</div></div>
        <aside className="diagnosis-panel"><div className="diagnosis-head"><BarChart3 size={23} /><div><span>本周诊断</span><strong>逻辑推理提升明显</strong></div></div><div className="radar-placeholder"><div className="score-ring"><strong>84</strong><span>综合掌握</span></div></div><dl><div><dt>优势</dt><dd>条件判断、问题拆解</dd></div><div><dt>待巩固</dt><dd>循环边界、变量更新</dd></div></dl></aside>
      </section>

      <section className="assistant-section" id="assistant">
        <div className="assistant-visual"><div className="assistant-avatar"><Bot size={34} /></div><div className="message student">为什么循环有时候会多执行一次？</div><div className="message ai">先看循环条件。你愿意用一个 0 到 4 的例子一起推演吗？</div><div className="typing"><span /><span /><span /></div></div>
        <div className="assistant-copy"><p className="eyebrow"><MessageSquareText size={16} /> AI 学习助教</p><h2>不直接给答案，陪你找到答案</h2><p>它会结合你的课程进度和最近错题，用追问、示例和可视化逐步引导。</p><ul><li><Clock3 size={18} />随时继续上一次讨论</li><li><Route size={18} />根据掌握度调整讲解方式</li><li><GraduationCap size={18} />教师可以查看学习过程</li></ul><button className="secondary-button" type="button" onClick={() => session ? null : setShowLogin(true)}>打开 AI 助教<ArrowRight size={17} /></button></div>
      </section>

      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark">eg</span><span>EduGraph AI</span></a><p>面向 K12 的多智能体教学平台</p><span>© 2026 K12 Platform</span></footer>
      {showLogin && <AuthDialog initialMode={authMode} onClose={() => setShowLogin(false)} onSuccess={(nextSession) => { setSession(nextSession); setShowLogin(false); }} />}
    </main>
  );
}
