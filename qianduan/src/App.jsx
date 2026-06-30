import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  Code2,
  GraduationCap,
  Image,
  Layers3,
  Menu,
  Mic2,
  MonitorPlay,
  Network,
  Play,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  X,
} from "lucide-react";

const roles = [
  {
    id: "student",
    title: "学生端",
    subtitle: "从绘本到代码的分龄学习体验",
    icon: GraduationCap,
    accent: "yellow",
    features: ["绘本式讲解", "概念动画", "在线编程辅导"],
  },
  {
    id: "teacher",
    title: "教师端",
    subtitle: "把资源生成、批改、学情分析合在一处",
    icon: Users,
    accent: "teal",
    features: ["班级学情看板", "作业批改结果", "课程资源管理"],
  },
  {
    id: "admin",
    title: "管理端",
    subtitle: "管理模型、题库、权限与运行状态",
    icon: ShieldCheck,
    accent: "pink",
    features: ["模型服务配置", "题库与用户权限", "系统日志监控"],
  },
];

const agents = [
  {
    id: "story",
    name: "绘本生成 Agent",
    icon: Image,
    title: "把机器学习讲成低年级能读懂的故事",
    detail:
      "识别学生年龄段后，自动生成故事大纲、分镜脚本、插图提示词与语音旁白，让抽象概念有画面和节奏。",
    chips: ["ComfyUI", "Flux", "TTS"],
    score: "93%",
  },
  {
    id: "animation",
    name: "动画演示 Agent",
    icon: MonitorPlay,
    title: "把排序、搜索、神经网络变成可播放动画",
    detail:
      "将知识点转为 Manim 脚本，异步渲染教学视频，并自动生成配套练习与诊断记录。",
    chips: ["Manim", "Kafka", "任务队列"],
    score: "21s",
  },
  {
    id: "code",
    name: "编程辅导 Agent",
    icon: Code2,
    title: "运行学生代码，再给分层提示",
    detail:
      "通过 Docker 沙箱捕获 stdout、stderr 和测试用例结果，再按错误位置、原因、方向、示例逐层引导。",
    chips: ["Monaco", "WebSocket", "Docker"],
    score: "5层",
  },
  {
    id: "path",
    name: "学情闭环 Agent",
    icon: Route,
    title: "从一次作答更新下一步学习路径",
    detail:
      "结合知识图谱、答题记录、代码错误类型和互动历史，持续更新学生画像并推荐复习或进阶内容。",
    chips: ["知识图谱", "向量库", "LangGraph"],
    score: "闭环",
  },
];

const demos = [
  "识别意图：学生问“为什么冒泡排序要交换？”",
  "选择策略：动画演示比文字解释更适合当前问题",
  "生成资源：Manim 脚本、旁白、练习题同步创建",
  "更新画像：循环结构掌握度上升，推荐下个项目任务",
];

const metrics = [
  { label: "教学 Agent", value: "7", note: "覆盖讲、画、演、编、批、诊、推" },
  { label: "学段模式", value: "3", note: "低年级、初中、高中动态切换" },
  { label: "闭环节点", value: "6", note: "讲解到路径推荐全链路" },
  { label: "核心展示", value: "3", note: "绘本课堂、动画课堂、编程辅导" },
];

function IconBadge({ icon: Icon, tone = "teal" }) {
  return (
    <span className={`icon-badge ${tone}`}>
      <Icon size={22} strokeWidth={2.4} />
    </span>
  );
}

function FeatureList({ items }) {
  return (
    <ul className="feature-list">
      {items.map((item) => (
        <li key={item}>
          <CheckCircle2 size={18} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function App() {
  const [roleId, setRoleId] = useState("student");
  const [agentId, setAgentId] = useState("story");
  const [demoStep, setDemoStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeRole = useMemo(
    () => roles.find((role) => role.id === roleId) ?? roles[0],
    [roleId],
  );
  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === agentId) ?? agents[0],
    [agentId],
  );
  const ActiveRoleIcon = activeRole.icon;
  const ActiveAgentIcon = activeAgent.icon;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="EduGraph AI home">
          <span className="brand-mark">eg</span>
          <span>EduGraph AI</span>
        </a>
        <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Main">
          <a href="#benchmarks">教学基准</a>
          <a href="#agents">Agent 编排</a>
          <a href="#studio">课堂工作台</a>
          <a href="#insights">学情闭环</a>
          <button className="more-button" type="button" aria-label="More">
            <span>更多</span>
            <ChevronDown size={16} />
          </button>
        </nav>
        <div className="header-actions">
          <label className="search-box">
            <Search size={20} />
            <input aria-label="Search" placeholder="搜索课程、Agent、题库" />
          </label>
          <button className="text-button" type="button">
            登录
          </button>
          <button className="primary-pill" type="button">
            注册
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={18} />
            LangGraph + 多模态生成 + 学情闭环
          </div>
          <h1>面向 K12 的 AI 教学操作系统</h1>
          <p>
            让 AI 不只回答问题，还能讲课、演示、陪练、批改并追踪学生成长。
            从绘本课堂到在线编程，系统会按学段自动选择最合适的教学方式。
          </p>
          <div className="hero-actions">
            <button className="google-like" type="button">
              <Brain size={20} />
              进入智能课堂
            </button>
            <button className="link-button" type="button">
              查看架构
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <div className="hero-art" aria-label="K12 AI learning journey illustration">
          <img src="/assets/k12-ai-learning-journey.png" alt="" />
          <div className="art-callout">
            <Network size={18} />
            <span>7 个教学 Agent 协同</span>
          </div>
        </div>
      </section>

      <section className="section" id="benchmarks">
        <div className="section-heading">
          <h2>谁在使用 EduGraph AI?</h2>
          <p>沿用 Kaggle 的清爽信息组织，把复杂平台拆成三类使用者和可验证能力。</p>
        </div>
        <div className="role-grid">
          {roles.map((role) => {
            const RoleIcon = role.icon;
            const selected = role.id === roleId;
            return (
              <button
                className={`role-card ${selected ? "selected" : ""}`}
                type="button"
                key={role.id}
                onClick={() => setRoleId(role.id)}
              >
                <div className="role-topline">
                  <IconBadge icon={RoleIcon} tone={role.accent} />
                  <span>{selected ? "当前视图" : "切换视图"}</span>
                </div>
                <h3>{role.title}</h3>
                <p>{role.subtitle}</p>
                <FeatureList items={role.features} />
              </button>
            );
          })}
        </div>
        <div className={`role-detail ${activeRole.accent}`}>
          <IconBadge icon={ActiveRoleIcon} tone={activeRole.accent} />
          <div>
            <p className="mini-label">当前角色体验</p>
            <h3>{activeRole.title}工作台</h3>
            <p>
              {activeRole.title}会看到专属信息密度、功能入口和反馈方式，低年级更重视图像与语音，
              高年级更重视代码、项目和即时诊断。
            </p>
          </div>
        </div>
      </section>

      <section className="section split-section" id="agents">
        <div className="section-heading compact">
          <h2>多智能体教学状态机</h2>
          <p>每一次学习请求都会被路由到合适 Agent，形成讲解、生成、练习、诊断、推荐的闭环。</p>
        </div>
        <div className="agent-shell">
          <div className="agent-tabs" role="tablist" aria-label="Agent tabs">
            {agents.map((agent) => {
              const AgentIcon = agent.icon;
              return (
                <button
                  key={agent.id}
                  className={agent.id === agentId ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={agent.id === agentId}
                  onClick={() => setAgentId(agent.id)}
                >
                  <AgentIcon size={18} />
                  <span>{agent.name}</span>
                </button>
              );
            })}
          </div>
          <article className="agent-panel">
            <div className="agent-title-row">
              <IconBadge icon={ActiveAgentIcon} tone="teal" />
              <div>
                <p className="mini-label">{activeAgent.name}</p>
                <h3>{activeAgent.title}</h3>
              </div>
              <strong>{activeAgent.score}</strong>
            </div>
            <p>{activeAgent.detail}</p>
            <div className="chip-row">
              {activeAgent.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="studio" id="studio">
        <div className="studio-copy">
          <p className="mini-label">课堂工作台</p>
          <h2>从学生提问到资源生成，只保留教师真正要操作的部分</h2>
          <p>
            左侧是课堂场景，右侧是实时生成与诊断状态。按钮、步骤、标签和终端都有交互反馈，
            方便继续扩展成真实前端。
          </p>
          <button className="primary-pill large" type="button" onClick={() => setDemoStep((step) => (step % demos.length) + 1)}>
            <Play size={18} />
            推进演示
          </button>
        </div>
        <div className="console">
          <div className="console-header">
            <div>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>live-classroom.graph</p>
          </div>
          <div className="lesson-card">
            <BookOpen size={24} />
            <div>
              <p className="mini-label">当前问题</p>
              <h3>用动画理解冒泡排序为什么要交换</h3>
            </div>
          </div>
          <div className="demo-steps">
            {demos.map((demo, index) => (
              <button
                key={demo}
                className={index + 1 <= demoStep ? "done" : ""}
                type="button"
                onClick={() => setDemoStep(index + 1)}
              >
                <span>{index + 1}</span>
                {demo}
              </button>
            ))}
          </div>
          <div className="terminal">
            <Terminal size={18} />
            <code>{"agent.route(\"animation\") -> render_task: queued -> mastery.loop += 12"}</code>
          </div>
        </div>
      </section>

      <section className="section insights" id="insights">
        <div className="section-heading">
          <h2>学情闭环，而不是一次性问答</h2>
          <p>平台把每次讲解、练习、代码提交和批改结果沉淀成可继续教学的上下文。</p>
        </div>
        <div className="metric-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <h3>{metric.label}</h3>
              <p>{metric.note}</p>
            </article>
          ))}
        </div>
        <div className="pipeline">
          {[
            ["AI讲解", Mic2],
            ["多模态演示", Layers3],
            ["学生练习", Code2],
            ["自动批改", CheckCircle2],
            ["学情诊断", BarChart3],
            ["路径推荐", Route],
          ].map(([label, Icon]) => (
            <div className="pipeline-node" key={label}>
              <Icon size={20} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
