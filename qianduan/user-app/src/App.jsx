import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Languages,
  LogOut,
  Menu,
  MessageSquareText,
  Play,
  Route,
  Search,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { getStoredSession, login, logout, register } from "./api/auth.js";

const courses = [
  { title: "Python 程序设计", subject: "信息科技", progress: 72, next: "循环结构与列表", lessons: "12 / 16 课时", icon: Code2, tone: "blue" },
  { title: "七年级数学", subject: "数学", progress: 46, next: "一元一次方程", lessons: "8 / 18 课时", icon: Target, tone: "yellow" },
  { title: "科学探究实验", subject: "科学", progress: 31, next: "控制变量法", lessons: "5 / 16 课时", icon: FlaskConical, tone: "teal" },
  { title: "英语阅读进阶", subject: "英语", progress: 58, next: "校园主题阅读", lessons: "7 / 12 课时", icon: Languages, tone: "pink" },
  { title: "人工智能启蒙", subject: "拓展课程", progress: 20, next: "认识分类模型", lessons: "2 / 10 课时", icon: Bot, tone: "violet" },
];

const todayTasks = [
  { title: "完成条件判断练习", meta: "10 道题 · 约 15 分钟", state: "进行中", icon: FileCheck2 },
  { title: "复习一元一次方程", meta: "错题巩固 · 约 12 分钟", state: "待完成", icon: Target },
  { title: "提交科学实验记录", meta: "今天 20:00 截止", state: "待提交", icon: Clock3 },
];

const recentActivity = [
  { title: "Python 循环练习", detail: "完成 8 道题，正确率 87%", time: "今天 10:24", icon: Code2 },
  { title: "数学错题诊断", detail: "已生成 3 个巩固知识点", time: "昨天 19:40", icon: BarChart3 },
  { title: "与 AI 助教讨论", detail: "冒泡排序为什么需要交换", time: "昨天 18:12", icon: MessageSquareText },
];

const recommendations = [
  { title: "循环边界专项练习", type: "薄弱点巩固", meta: "10 道题 · 约 12 分钟", reason: "根据最近 3 次代码提交推荐", icon: Code2, tone: "blue" },
  { title: "冒泡排序动画演示", type: "概念可视化", meta: "6 分钟 · 含同步练习", reason: "与你正在学习的循环结构相关", icon: Play, tone: "teal" },
  { title: "一元一次方程错题复盘", type: "AI 诊断", meta: "3 个知识点 · 5 道题", reason: "根据昨日数学练习结果推荐", icon: BarChart3, tone: "yellow" },
];

function AuthDialog({ initialMode = "login", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: "", password: "", nickname: "", email: "" });
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
        <button className="icon-button dialog-close" type="button" title="关闭" onClick={onClose}><X size={19} /></button>
        <div className="dialog-brand"><span>eg</span></div>
        <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建学习账号"}</p>
        <h2 id="login-title">{mode === "login" ? "登录学习空间" : "注册学生账号"}</h2>
        <p className="dialog-note">{mode === "login" ? "登录后同步课程、作业和学习记录。" : "新账号将自动获得学生角色。"}</p>
        <form onSubmit={handleSubmit}>
          <label>用户名<input autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="请输入用户名" required /></label>
          {mode === "register" && <label>姓名或昵称<input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="例如：小明" required /></label>}
          {mode === "register" && <label>邮箱（选填）<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" /></label>}
          <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="请输入密码" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={submitting}>{submitting ? "正在提交..." : mode === "login" ? "登录" : "注册并登录"}</button>
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
  const courseRailRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([
    { role: "assistant", text: "今天想复习哪个知识点？我可以结合你的课程进度讲解。" },
  ]);
  const displayName = useMemo(() => session?.user?.username ?? "同学", [session]);

  function openAuth(mode) {
    setAuthMode(mode);
    setShowLogin(true);
  }

  function requireLogin(action) {
    if (session) {
      action?.();
      return;
    }
    openAuth("login");
  }

  function handleLogout() {
    logout();
    setSession(null);
  }

  function askAssistant(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    if (!session) {
      openAuth("login");
      return;
    }
    setConversation((current) => [...current, { role: "user", text }, { role: "assistant", text: "问题已记录。我会结合当前课程和最近错题，为你生成分步骤讲解。" }]);
    setQuestion("");
  }

  function scrollCourses(direction) {
    courseRailRef.current?.scrollBy({ left: direction * 300, behavior: "smooth" });
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="EduGraph AI 学习首页"><span className="brand-mark">eg</span><span>EduGraph AI</span></a>
        <nav className={menuOpen ? "open" : ""} aria-label="主导航">
          <a className="active" href="#top">学习首页</a>
          <a href="#courses">我的课程</a>
          <a href="#tasks">作业练习</a>
          <a href="#assistant">AI 助教</a>
        </nav>
        <div className="header-actions">
          <label className="header-search"><Search size={16} /><input aria-label="搜索" placeholder="搜索课程、知识点、题目" /></label>
          {session ? (
            <div className="user-menu"><button className="icon-button" type="button" title="通知"><Bell size={17} /></button><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span>{displayName}</span><button className="icon-button" type="button" title="退出登录" onClick={handleLogout}><LogOut size={17} /></button></div>
          ) : <><button className="header-login" type="button" onClick={() => openAuth("login")}>登录</button><button className="header-register" type="button" onClick={() => openAuth("register")}>注册</button></>}
          <button className="icon-button mobile-menu" type="button" title="菜单" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <div className="home" id="top">
        <section className="home-hero">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={14} /> 今日学习计划已更新</p>
            <h1>{session ? `${displayName}，继续你的学习路径` : "开启今天的学习"}</h1>
            <p>{session ? "Python 课程进度领先于本周计划，接下来建议完成循环结构练习。" : "登录后同步课程、作业、学习记录和个性化推荐。"}</p>
            <div className="hero-actions"><button className="button primary" type="button" onClick={() => requireLogin(() => document.querySelector("#courses")?.scrollIntoView())}><Play size={17} />继续 Python 课程</button><button className="text-button" type="button" onClick={() => document.querySelector("#recommendations")?.scrollIntoView()}>查看今日推荐<ArrowRight size={16} /></button></div>
            <dl className="hero-summary"><div><dt>今日任务</dt><dd>3 项</dd></div><div><dt>预计用时</dt><dd>42 分钟</dd></div><div><dt>本周进度</dt><dd>67%</dd></div></dl>
          </div>
          <div className="hero-image"><img src="/assets/k12-ai-learning-journey.png" alt="学生沿着个性化学习路径前往智能课堂" /><span><Route size={16} />当前节点：循环结构</span></div>
        </section>

        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="panel" id="courses">
              <header className="panel-heading"><div><h2>我的课程</h2><p>从上次离开的地方继续</p></div><div className="carousel-actions"><button className="icon-button" type="button" title="上一组课程" onClick={() => scrollCourses(-1)}><ChevronLeft size={17} /></button><button className="icon-button" type="button" title="下一组课程" onClick={() => scrollCourses(1)}><ChevronRight size={17} /></button></div></header>
              <div className="course-rail" ref={courseRailRef}>{courses.map(({ icon: Icon, ...course }) => <article className="course-card" key={course.title}><span className={`course-cover ${course.tone}`}><Icon size={27} /></span><div className="course-card-copy"><small>{course.subject}</small><h3>{course.title}</h3><p>下一节：{course.next}</p></div><div className="course-progress"><div><span style={{ width: `${course.progress}%` }} /></div><small>{course.progress}% · {course.lessons}</small></div><button className="course-open" type="button" onClick={() => requireLogin()}>继续学习<ArrowRight size={15} /></button></article>)}</div>
            </section>

            <section className="panel recommendation-panel" id="recommendations">
              <header className="panel-heading"><div><h2>为你推荐</h2><p>根据课程进度、错题和近期提问生成</p></div><button className="text-button" type="button">换一批<ChevronRight size={16} /></button></header>
              <div className="recommendation-grid">{recommendations.map(({ icon: Icon, ...item }) => <button type="button" key={item.title} onClick={() => requireLogin()}><span className={`recommendation-icon ${item.tone}`}><Icon size={21} /></span><small>{item.type}</small><strong>{item.title}</strong><p>{item.meta}</p><em>{item.reason}</em><ArrowRight className="recommendation-arrow" size={16} /></button>)}</div>
            </section>

            <section className="panel assistant-panel" id="assistant">
              <header className="panel-heading"><div><h2>AI 学习助教</h2><p>结合当前课程、错题和学习画像回答</p></div><span className="online"><i />在线</span></header>
              <div className="conversation" aria-live="polite">{conversation.slice(-3).map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Bot size={17} /> : displayName.slice(0, 1)}</span><p>{message.text}</p></div>)}</div>
              <form className="assistant-input" onSubmit={askAssistant}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入你不理解的知识点..." aria-label="向 AI 助教提问" /><button className="send-button" type="submit" title="发送问题"><Send size={17} /></button></form>
            </section>

            <section className="panel activity-panel">
              <header className="panel-heading"><div><h2>最近学习</h2><p>你的课程、练习和助教记录</p></div></header>
              <div className="activity-list">{recentActivity.map(({ icon: Icon, ...item }) => <article key={item.title}><span><Icon size={18} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></article>)}</div>
            </section>
          </div>

          <aside className="dashboard-side">
            <section className="panel task-panel" id="tasks">
              <header className="panel-heading"><div><h2>今日任务</h2><p>3 项待处理</p></div></header>
              <div className="task-list">{todayTasks.map(({ icon: Icon, ...task }, index) => <button type="button" key={task.title} onClick={() => requireLogin()}><span className={index === 0 ? "active" : ""}><Icon size={17} /></span><div><strong>{task.title}</strong><small>{task.meta}</small></div><em>{task.state}</em></button>)}</div>
              <button className="button secondary full" type="button" onClick={() => requireLogin()}><FileCheck2 size={17} />进入作业中心</button>
            </section>

            <section className="panel path-panel">
              <header className="panel-heading"><div><h2>本周学习路径</h2><p>目标完成 4 / 6</p></div><strong>67%</strong></header>
              <img src="/assets/k12-ai-learning-journey.png" alt="个性化学习路径" />
              <div className="path-progress"><span style={{ width: "67%" }} /></div>
              <ul><li className="done"><CheckCircle2 size={16} />变量与数据类型</li><li className="done"><CheckCircle2 size={16} />条件判断</li><li className="current"><Route size={16} />循环结构</li><li><GraduationCap size={16} />综合项目</li></ul>
            </section>

            <section className="panel insight-panel">
              <span className="insight-icon"><BarChart3 size={20} /></span><div><small>本周学情</small><strong>逻辑推理提升明显</strong><p>建议继续巩固循环边界和变量更新。</p></div>
            </section>
          </aside>
        </div>
      </div>

      <footer className="site-footer"><a className="brand" href="#top"><span className="brand-mark">eg</span><span>EduGraph AI</span></a><p>面向 K12 的多智能体教学平台</p><span>© 2026 K12 Platform</span></footer>
      {showLogin && <AuthDialog initialMode={authMode} onClose={() => setShowLogin(false)} onSuccess={(nextSession) => { setSession(nextSession); setShowLogin(false); }} />}
    </main>
  );
}
