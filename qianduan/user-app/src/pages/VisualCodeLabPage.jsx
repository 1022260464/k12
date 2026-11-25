import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Play,
  Star,
  Wand2,
  Wifi,
} from "lucide-react";
import { BlocklyWorkspace } from "../components/blockly/BlocklyWorkspace.jsx";
import { MissionHoverPreview } from "../components/blockly/MissionHoverPreview.jsx";
import { MissionStage } from "../components/blockly/MissionStage.jsx";
import {
  BLOCKLY_STORAGE_VERSION,
  DEFAULT_BLOCKLY_MISSIONS,
  demoProgramFor,
  evaluateBlocklyMission,
  mergeEvaluationAdvice,
  normalizeMission,
} from "../data/blocklyMissions.js";
import { blocklyStorageKey, readBlocklyProgress } from "../data/blocklyProgress.js";
import { visualProgrammingApi } from "../api/client.js";
import { ExperiencePageHeader } from "../components/ExperiencePageHeader.jsx";
import { EXPERIENCE } from "../experience/experience.js";
import ScratchStudio from "../components/scratch/ScratchStudio.jsx";

const EMPTY_STAGE = {
  robotPosition: 8,
  speech: "连接积木后点击运行",
  labels: [],
  datasetCount: 0,
  trained: false,
  prediction: null,
  predictionConfidence: null,
  balanceStatus: null,
  quizScore: null,
  quizAnswered: 0,
  currentScene: null,
};

export function VisualCodeLabPage({ session, requireLogin, navigate, experience = EXPERIENCE.PRIMARY }) {
  const identity = session?.userId || session?.username || session?.user?.username || "guest";
  const storageKey = blocklyStorageKey(session);
  const [missions, setMissions] = useState(DEFAULT_BLOCKLY_MISSIONS);
  const [missionSource, setMissionSource] = useState("builtin");
  const [labState, setLabState] = useState(() => readBlocklyProgress(session));
  const [missionId, setMissionId] = useState(DEFAULT_BLOCKLY_MISSIONS[0].id);
  const [stage, setStage] = useState(EMPTY_STAGE);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [coachClosed, setCoachClosed] = useState({});
  const [hoverMissionId, setHoverMissionId] = useState(null);
  const [syncState, setSyncState] = useState("local");
  /** 🎬 自由创作是默认页（Scratch 式）；AI 积木任务收进第二个标签。 */
  const [tab, setTab] = useState("studio");
  const runRevisionRef = useRef(0);
  const workspaceRef = useRef(null);

  const mission = useMemo(
    () => missions.find((item) => item.id === missionId) || missions[0] || DEFAULT_BLOCKLY_MISSIONS[0],
    [missionId, missions],
  );

  useEffect(() => {
    let active = true;
    visualProgrammingApi.missions()
      .then((items) => {
        if (!active) return;
        const list = (Array.isArray(items) ? items : [])
          .map(normalizeMission)
          .filter(Boolean)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        if (list.length) {
          setMissions(list);
          setMissionSource("remote");
          setMissionId((current) => (list.some((item) => item.id === current) ? current : list[0].id));
        } else {
          setMissions(DEFAULT_BLOCKLY_MISSIONS);
          setMissionSource("builtin");
        }
      })
      .catch(() => {
        if (!active) return;
        setMissions(DEFAULT_BLOCKLY_MISSIONS);
        setMissionSource("builtin");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const requested = sessionStorage.getItem("k12-visual-mission");
    if (!requested || !missions.some((item) => item.id === requested || item.missionCode === requested)) return;
    const target = missions.find((item) => item.id === requested || item.missionCode === requested);
    setMissionId(target.id);
    setTab("missions"); // 课程/任务深链直达 AI 任务标签
    sessionStorage.removeItem("k12-visual-mission");
  }, [missions]);

  useEffect(() => {
    const next = readBlocklyProgress(session);
    setLabState(next);
    if (!session) {
      setSyncState("local");
      return undefined;
    }
    let active = true;
    setSyncState("loading");
    visualProgrammingApi.mine()
      .then((projects) => {
        if (!active) return;
        const remote = Array.isArray(projects) ? projects : [];
        // 必须并入“当前”状态：mine() 在飞行期间孩子可能已保存（拖积木/点示范程序），
        // 若用挂载时的旧快照合并，返回时会把那些保存整份冲掉。
        setLabState((current) => {
          const merged = mergeRemoteProjects(current, remote);
          localStorage.setItem(storageKey, JSON.stringify(merged));
          return merged;
        });
        setSyncState("synced");
      })
      .catch(() => {
        if (active) setSyncState("local");
      });
    return () => { active = false; };
  }, [storageKey, session]);

  useEffect(() => {
    runRevisionRef.current += 1;
    setStage(initialStage(mission));
    setResult(null);
    setRunError("");
    setRunning(false);
    setShowHint(false);
  }, [mission.id]);

  function persist(updater) {
    setLabState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function saveWorkspace(workspace) {
    persist((current) => ({
      ...current,
      workspaces: { ...current.workspaces, [mission.id]: workspace },
      updatedAt: new Date().toISOString(),
    }));
  }

  /** 「示范程序」：一键把本关满分积木摆进工作区，小学生照着运行就能看懂。 */
  function loadDemoProgram() {
    const demo = demoProgramFor(mission);
    if (!demo) {
      setRunError("这一关暂时没有示范程序");
      return;
    }
    setShowHint(false);
    setRunError("");
    workspaceRef.current?.loadDemo?.(demo);
  }

  async function runCommands(commands, compileError, workspaceState) {
    if (compileError || !commands) {
      setRunError(compileError?.message || "积木暂时无法运行");
      setResult(null);
      return;
    }

    const revision = runRevisionRef.current + 1;
    runRevisionRef.current = revision;
    const runtime = createRuntime(mission);
    setStage(runtime.stage());
    setResult(null);
    setRunError("");
    setRunning(true);

    try {
      await executeCommands(commands, runtime, (nextStage) => {
        if (runRevisionRef.current === revision) setStage(nextStage);
      });
      if (runRevisionRef.current !== revision) return;
      let evaluation = evaluateBlocklyMission(mission, runtime.trace);
      if (workspaceState && session) {
        try {
          const saved = await visualProgrammingApi.save(mission.missionCode || mission.id, workspaceState);
          if (saved?.evaluation) {
            // 服务端评分权威（passed/stars）；失败建议用本地 trace 算的更具体文案
            evaluation = mergeEvaluationAdvice(saved.evaluation, evaluation);
          }
          setSyncState("synced");
        } catch {
          setSyncState("local");
        }
      }
      setResult(evaluation);
      if (evaluation.passed && runRevisionRef.current === revision) {
        // 通关高光：机器人欢呼跳 + 舞台撒花，像 Scratch 的绿旗收尾
        runtime.pose = "cheer";
        runtime.speech = "任务完成，撒花！";
        runtime.emit("celebrate", { stars: evaluation.stars });
        setStage(runtime.stage());
      }
      if (evaluation.passed) {
        persist((current) => {
          const previous = current.completed[mission.id];
          return {
            ...current,
            completed: {
              ...current.completed,
              [mission.id]: {
                stars: Math.max(previous?.stars || 0, evaluation.stars),
                completedAt: new Date().toISOString(),
              },
            },
          };
        });
      }
    } catch (error) {
      if (runRevisionRef.current === revision) setRunError(error.message || "运行过程中出现问题");
    } finally {
      if (runRevisionRef.current === revision) setRunning(false);
    }
  }

  const completedCount = missions.filter((item) => labState.completed[item.id]).length;
  const earnedStars = missions.reduce((total, item) => total + Number(labState.completed[item.id]?.stars || 0), 0);
  const primary = experience === EXPERIENCE.PRIMARY;
  const nextMission = missions.find((item) => item.order > mission.order && !labState.completed[item.id])
    || missions.find((item) => !labState.completed[item.id] && item.id !== mission.id);

  return (
    <div className="page inner-page visual-code-lab-page">
      <ExperiencePageHeader
        experience={experience}
        eyebrow={primary ? "小学高年级 · 图形化编程" : "图形化创作 · 可视化算法"}
        title={primary ? "积木创作工坊" : "积木创作工坊"}
        description="像 Scratch 一样拖积木、点绿旗，让角色动起来、画出作品；再挑战一关关 AI 积木任务。"
        imageKey="code"
      >
        <div className="visual-lab-summary">
          <span><CheckCircle2 size={15} />完成 {completedCount}/{missions.length} 关</span>
          <span><Star size={15} />获得 {earnedStars}/{missions.length * 3} 颗星</span>
          <span><CloudStateIcon state={syncState} />{syncLabel(syncState)}</span>
          {missionSource === "builtin" && (
            <span className="is-fallback"><CloudOff size={15} />使用内置课程</span>
          )}
        </div>
      </ExperiencePageHeader>

      {!session && (
        <section className="visual-lab-login">
          <LockKeyhole size={22} />
          <div>
            <strong>现在可以直接试玩</strong>
            <p>游客进度保存在本机；登录后可同步作品和闯关记录。</p>
          </div>
          <button className="button primary" type="button" onClick={() => requireLogin()}>登录并同步</button>
        </section>
      )}

      <div className="visual-lab-tabs" role="tablist" aria-label="积木工坊模式">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "studio"}
          className={`visual-lab-tab ${tab === "studio" ? "active" : ""}`}
          onClick={() => setTab("studio")}
        >
          🎬 自由创作
          <small>像 Scratch 一样编程序</small>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "missions"}
          className={`visual-lab-tab ${tab === "missions" ? "active" : ""}`}
          onClick={() => setTab("missions")}
        >
          🧠 AI 积木任务
          <small>{missions.length} 关闯关挑战</small>
        </button>
      </div>

      {tab === "studio" && (
        <ScratchStudio identity={identity} />
      )}

      {tab === "missions" && (
        <>
      <section className="visual-mission-rail" aria-label="图形化编程关卡">
        {missions.map((item) => {
          const completed = labState.completed[item.id];
          const previewOpen = hoverMissionId === item.id;
          return (
            <div
              key={item.id}
              className={`visual-mission-rail-item ${previewOpen ? "is-previewing" : ""}`}
              onMouseEnter={() => setHoverMissionId(item.id)}
              onMouseLeave={() => setHoverMissionId((current) => (current === item.id ? null : current))}
            >
              <button
                type="button"
                className={`theme-${item.theme || "labeling"} ${mission.id === item.id ? "active" : ""} ${completed ? "completed" : ""}`}
                onClick={() => setMissionId(item.id)}
                onFocus={() => setHoverMissionId(item.id)}
                onBlur={() => setHoverMissionId((current) => (current === item.id ? null : current))}
                aria-describedby={previewOpen ? `mission-preview-${item.id}` : undefined}
              >
                <span className="mission-number">{completed ? <CheckCircle2 size={17} /> : item.order}</span>
                <span>
                  <small>第 {item.order} 关 · {item.shortTitle}</small>
                  <strong>{item.title}</strong>
                </span>
                {completed ? <span className="mission-stars">{completed.stars}/3</span> : <ChevronRight size={16} />}
              </button>
              {previewOpen && (
                <div
                  id={`mission-preview-${item.id}`}
                  className="visual-mission-hover-pop"
                  role="tooltip"
                >
                  <MissionHoverPreview mission={item} completed={completed} />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className={`visual-mission-brief theme-${mission.theme || "labeling"}`}>
        <div>
          <span className="blockly-panel-kicker">当前任务</span>
          <h2>{mission.title}</h2>
          <p>{mission.description}</p>
          <p className="visual-mission-story">{mission.story}</p>
        </div>
        <div className="visual-mission-goal">
          <strong><Play size={15} />过关目标</strong>
          <p>{mission.goal}</p>
          <div>{mission.concepts.map((concept) => <span key={concept}>{concept}</span>)}</div>
          {mission.recipe?.length > 0 && (
            <div className="visual-mission-recipe">
              <strong>🧱 这一关要摆的积木</strong>
              <ol>
                {mission.recipe.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          )}
        </div>
        <div className="visual-mission-actions">
          <button className="visual-hint-button" type="button" onClick={() => setShowHint((value) => !value)}>
            <Lightbulb size={16} />{showHint ? mission.hint : "需要提示"}
          </button>
          <button className="visual-demo-button" type="button" onClick={loadDemoProgram}>
            <Wand2 size={16} />示范程序
          </button>
        </div>
      </section>

      <section className="visual-learning-route" aria-label="本关学习步骤">
        <div className="visual-learning-route-title">
          <ListChecks size={18} />
          <span><small>学习路线</small><strong>按三个步骤完成挑战</strong></span>
        </div>
        {mission.steps.map((step, index) => (
          <div className="visual-learning-step" key={`${mission.id}-${step}`}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
        <div className="visual-learning-badge">
          <Award size={18} />
          <span><small>通关徽章</small><strong>{mission.badge}</strong></span>
        </div>
      </section>

      <div className="visual-lab-workspace">
        <BlocklyWorkspace
          key={mission.id}
          ref={workspaceRef}
          mission={mission}
          savedState={labState.workspaces[mission.id]}
          onChange={saveWorkspace}
          onRun={runCommands}
          coach={
            !hasRealProgress(labState.workspaces[mission.id])
            && !coachClosed[mission.id]
            && !result
          }
          onCoachClose={() => setCoachClosed((current) => ({ ...current, [mission.id]: true }))}
        />
        <MissionStage mission={mission} stage={stage} result={result} running={running} error={runError} />
      </div>

      {result?.passed && nextMission && (
        <section className="visual-lab-next-mission">
          <div>
            <SparklesIcon />
            <div>
              <strong>下一关已就绪：{nextMission.title}</strong>
              <p>{nextMission.description}</p>
            </div>
          </div>
          <button className="button primary" type="button" onClick={() => setMissionId(nextMission.id)}>
            挑战下一关 <ArrowRight size={16} />
          </button>
        </section>
      )}
        </>
      )}
    </div>
  );
}

function SparklesIcon() {
  return <Award size={22} />;
}

function initialStage(mission) {
  const template = mission?.templateCode;
  if (["PREDICTION_BRANCH", "CONFIDENCE_GATE", "AGENT_PATROL"].includes(template)
    || ["predict-and-decide", "confidence-gate", "campus-ai-patrol"].includes(mission?.id)) {
    return { ...EMPTY_STAGE, datasetCount: 4, speech: "训练后试试神秘图片" };
  }
  return { ...EMPTY_STAGE, labels: [] };
}

const STAGE_IMAGE_NAMES = {
  "cat-1": "猫图片 1",
  "cat-2": "猫图片 2",
  "dog-1": "狗图片 1",
  "dog-2": "狗图片 2",
  "mystery-cat": "神秘图片",
  "mystery-dog": "校园小狗",
};

function stageCategoryName(value) {
  if (value === "cat") return "猫";
  if (value === "dog") return "狗";
  return "未知";
}

function createRuntime(mission) {
  const config = mission?.runtimeConfig || {};
  const labels = new Map();
  if (["PREDICTION_BRANCH", "CONFIDENCE_GATE", "AGENT_PATROL"].includes(mission?.templateCode)
    || ["predict-and-decide", "confidence-gate", "campus-ai-patrol"].includes(mission?.id)) {
    labels.set("cat-1", "cat");
    labels.set("cat-2", "cat");
    labels.set("dog-1", "dog");
    labels.set("dog-2", "dog");
  }
  const runtime = {
    missionId: mission.id,
    labels,
    trained: labels.size >= 4,
    prediction: null,
    predictionConfidence: null,
    balanceStatus: null,
    quizAnswers: new Map(),
    quizScore: null,
    currentScene: null,
    robotPosition: 8,
    speech: labels.size ? "训练后试试神秘图片" : "连接积木后点击运行",
    pose: "idle",
    fx: null,
    fxSeq: 0,
    trace: [],
    /** 一次性舞台特效指令：MissionStage 以 fx.id 作 key 播放一段 CSS 动画（飞卡片/翻牌/撒花…）。 */
    emit(kind, data = {}) {
      this.fxSeq += 1;
      this.fx = { id: this.fxSeq, kind, ...data };
    },
    stage() {
      return {
        robotPosition: this.robotPosition,
        speech: this.speech,
        pose: this.pose,
        fx: this.fx,
        labels: [...this.labels.entries()].map(([imageId, category]) => ({ imageId, category })),
        datasetCount: this.labels.size,
        trained: this.trained,
        prediction: this.prediction,
        predictionConfidence: this.predictionConfidence,
        balanceStatus: this.balanceStatus,
        quizScore: this.quizScore,
        quizAnswered: this.quizAnswers.size,
        currentScene: this.currentScene,
      };
    },
    label(imageId, category) {
      this.labels.set(imageId, category);
      this.pose = "happy";
      this.speech = `${STAGE_IMAGE_NAMES[imageId] || imageId} 是 ${stageCategoryName(category)}`;
      this.emit("label", { imageId, category });
      this.trace.push({ type: "LABEL", imageId, category });
    },
    train() {
      const success = this.labels.size >= 2 && new Set(this.labels.values()).size >= 2;
      this.trained = success;
      this.pose = "thinking";
      this.speech = "AI 正在学习这些图片…";
      this.emit("train", { success });
      this.trace.push({ type: "TRAIN", success, count: this.labels.size });
    },
    trainDone() {
      // 只负责展示「学习完成」的表情和台词，trace 已由 train() 记录
      this.pose = this.trained ? "happy" : "sad";
      this.speech = this.trained ? "学会啦！我认识这些图片了" : "还要更多不同类别的图片哦";
      this.emit("trainDone", { success: this.trained });
    },
    predict(imageId) {
      if (!this.trained) {
        this.prediction = "unknown";
        this.predictionConfidence = 0;
        this.pose = "sad";
        this.speech = "先教我认识图片，我才能猜哦";
        this.emit("predict", { imageId, prediction: "unknown", confidence: 0 });
        this.trace.push({ type: "PREDICT", imageId, prediction: "unknown", confidence: 0 });
        return;
      }
      const configured = config.predictionCategory || config.expectedCategory;
      let prediction = "unknown";
      if (imageId?.includes("cat") || configured === "cat") prediction = configured || "cat";
      if (imageId?.includes("dog") || configured === "dog") prediction = configured || "dog";
      if (imageId === "mystery-cat") prediction = config.expectedCategory || config.predictionCategory || "cat";
      if (imageId === "mystery-dog") prediction = config.expectedCategory || config.predictionCategory || "dog";
      const confidence = Number(config.simulatedConfidence || (prediction === "cat" ? 92 : prediction === "dog" ? 88 : 40));
      this.prediction = prediction;
      this.predictionConfidence = confidence;
      this.pose = "thinking";
      this.speech = `AI 猜：这是${stageCategoryName(prediction)}（把握 ${confidence}%）`;
      this.emit("predict", { imageId, prediction, confidence });
      this.trace.push({ type: "PREDICT", imageId, prediction, confidence });
    },
    move(steps) {
      const value = Math.max(1, Number(steps) || 1);
      this.robotPosition = Math.min(86, this.robotPosition + value * 6);
      this.pose = "walking";
      this.speech = `走 ${value} 步！`;
      this.emit("move", { steps: value });
      this.trace.push({ type: "MOVE", steps: value });
    },
    say(message) {
      this.speech = String(message || "");
      this.pose = "happy";
      this.emit("say", { message: this.speech });
      this.trace.push({ type: "SAY", message: this.speech });
    },
    condition(expected, matched) {
      this.pose = matched ? "happy" : "sad";
      this.speech = matched
        ? `AI 猜对啦，是${stageCategoryName(expected)}！`
        : `AI 猜的不是${stageCategoryName(expected)}，这一步先不执行`;
      this.emit("condition", { expected, matched: Boolean(matched) });
      this.trace.push({ type: "CONDITION", expected, matched: Boolean(matched) });
    },
    confidenceCondition(threshold, matched) {
      this.pose = matched ? "happy" : "sad";
      this.speech = matched ? `把握达到 ${threshold}%，通过！` : `把握还不到 ${threshold}%，先不执行`;
      this.emit("confidence", { threshold: Number(threshold) || 0, matched: Boolean(matched) });
      this.trace.push({ type: "CONFIDENCE_CONDITION", threshold: Number(threshold) || 0, matched: Boolean(matched) });
    },
    repeat(times) {
      this.trace.push({ type: "REPEAT", times: Number(times) || 0 });
    },
    checkBalance() {
      const required = config.requiredClasses || ["cat", "dog"];
      const counts = required.map((category) => (
        [...this.labels.values()].filter((value) => value === category).length
      ));
      const maxDifference = Number(config.maxDifference ?? 0);
      const minSamples = Number(config.minSamplesPerClass || 2);
      const balanced = counts.every((count) => count >= minSamples)
        && Math.max(...counts) - Math.min(...counts) <= maxDifference;
      this.balanceStatus = balanced ? "数据均衡" : "数据仍不均衡";
      this.pose = balanced ? "happy" : "sad";
      this.speech = balanced ? "两类数据一样多，更公平" : "再补充较少的那一类";
      this.emit("balance", { balanced, counts });
      this.trace.push({ type: "BALANCE_CHECK", balanced, counts });
    },
    quizAnswer(questionId, answer) {
      this.quizAnswers.set(questionId, answer);
      const questionIndex = Number(String(questionId).replace("q", "")) || 1;
      this.speech = `第 ${questionIndex} 题选了 ${String(answer || "").toUpperCase()}`;
      this.emit("quiz", { questionId, answer });
      this.trace.push({ type: "QUIZ_ANSWER", questionId, answer });
    },
    quizSubmit() {
      const expected = config.expectedAnswers || ["b", "b", "a"];
      this.quizScore = expected.reduce((total, answer, index) => (
        total + (this.quizAnswers.get(`q${index + 1}`) === answer ? 1 : 0)
      ), 0);
      this.pose = this.quizScore === 3 ? "cheer" : "sad";
      this.speech = `答对 ${this.quizScore} 题！`;
      this.emit("quizScore", { score: this.quizScore });
      this.trace.push({ type: "QUIZ_SUBMIT", score: this.quizScore });
    },
    switchScene(sceneId) {
      this.currentScene = sceneId;
      const labelsByScene = { classroom: "AI 教室", lab: "AI 实验室", future: "未来城市" };
      this.speech = `来到${labelsByScene[sceneId] || sceneId}`;
      this.emit("scene", { sceneId });
      this.trace.push({ type: "SCENE", sceneId });
    },
    wait(seconds) {
      const value = Math.min(10, Math.max(1, Number(seconds) || 1));
      this.pose = "sleep";
      this.speech = `安静地等 ${value} 秒…`;
      this.emit("wait", { seconds: value });
      this.trace.push({ type: "WAIT", seconds: value });
    },
  };
  return runtime;
}

/** 每种积木在舞台上的「表演时长」：像 Scratch 一样一块一块看得见地执行，
 * 而不是 220ms 一闪而过。WAIT 按孩子设的秒数真的停顿（上限 3 秒）。 */
const COMMAND_DWELL_MS = {
  LABEL: 700,
  TRAIN: 1300,
  PREDICT: 1000,
  MOVE: 520,
  SAY: 800,
  BALANCE_CHECK: 1000,
  QUIZ_ANSWER: 550,
  QUIZ_SUBMIT: 900,
  SCENE: 1100,
  IF_PREDICTION: 600,
  IF_CONFIDENCE: 600,
  REPEAT: 300,
};

async function executeCommands(commands, runtime, onStage) {
  for (const command of commands) {
    await sleep(120);
    switch (String(command.type || "").toUpperCase()) {
      case "LABEL":
        runtime.label(command.imageId, command.category);
        break;
      case "TRAIN":
        // 两段式：先「学习中…」停一拍，再亮出学习结果
        runtime.train();
        onStage(runtime.stage());
        await sleep(COMMAND_DWELL_MS.TRAIN);
        runtime.trainDone();
        break;
      case "PREDICT":
        runtime.predict(command.imageId);
        break;
      case "MOVE":
        runtime.move(command.steps);
        break;
      case "SAY":
        runtime.say(command.message);
        break;
      case "BALANCE_CHECK":
        runtime.checkBalance();
        break;
      case "QUIZ_ANSWER":
        runtime.quizAnswer(command.questionId, command.answer);
        break;
      case "QUIZ_SUBMIT":
        runtime.quizSubmit();
        break;
      case "SCENE":
        runtime.switchScene(command.sceneId);
        break;
      case "WAIT":
        runtime.wait(command.seconds);
        break;
      case "IF_PREDICTION": {
        const matched = runtime.prediction === command.expected;
        runtime.condition(command.expected, matched);
        if (matched && command.commands?.length) {
          await executeCommands(command.commands, runtime, onStage);
        }
        break;
      }
      case "IF_CONFIDENCE": {
        const threshold = Number(command.threshold) || 80;
        const matched = Number(runtime.predictionConfidence || 0) >= threshold;
        runtime.confidenceCondition(threshold, matched);
        if (matched && command.commands?.length) {
          await executeCommands(command.commands, runtime, onStage);
        }
        break;
      }
      case "REPEAT": {
        const times = Math.min(10, Math.max(1, Number(command.times) || 1));
        runtime.repeat(times);
        for (let index = 0; index < times; index += 1) {
          if (command.commands?.length) await executeCommands(command.commands, runtime, onStage);
        }
        break;
      }
      default:
        break;
    }
    onStage(runtime.stage());
    const commandType = String(command.type || "").toUpperCase();
    const dwell = commandType === "WAIT"
      ? Math.min(3000, 1000 * (Math.max(1, Number(command.seconds) || 1)))
      : (COMMAND_DWELL_MS[commandType] ?? 220);
    await sleep(dwell);
  }
}

/** 工作区是否真的有进度：只有孤零零的初始「开始任务」（或空）不算。
 * v13 序列化的 blocks.blocks 只含顶层块，本实验室程序都连在帽子块下（长度恒为 1），
 * 所以要判断「开始任务」有没有挂子块，首访引导卡据此保持可见。 */
function hasRealProgress(state) {
  if (!state || typeof state !== "object") return false;
  const blocks = state.blocks?.blocks || [];
  if (blocks.length === 0) return false;
  if (blocks.length === 1 && blocks[0]?.type === "k12_when_start") {
    const start = blocks[0];
    if (start.next?.block) return true;
    return Object.values(start.inputs || {}).some((input) => input?.block || input?.shadow);
  }
  return true;
}

function mergeRemoteProjects(local, remote) {
  const next = {
    version: BLOCKLY_STORAGE_VERSION,
    workspaces: { ...local.workspaces },
    completed: { ...local.completed },
  };
  for (const project of remote) {
    const code = project.missionCode;
    if (!code) continue;
    if (project.workspace && !next.workspaces[code]) {
      next.workspaces[code] = typeof project.workspace === "string"
        ? JSON.parse(project.workspace)
        : project.workspace;
    }
    if (project.status === "COMPLETED" || project.bestStars > 0) {
      next.completed[code] = {
        stars: Math.max(next.completed[code]?.stars || 0, Number(project.bestStars || 0)),
        completedAt: project.completedTime || new Date().toISOString(),
      };
    }
  }
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function syncLabel(state) {
  if (state === "synced") return "已同步云端";
  if (state === "loading") return "同步中…";
  return "仅本机进度";
}

function CloudStateIcon({ state }) {
  if (state === "synced") return <Wifi size={15} />;
  if (state === "loading") return <Wifi size={15} />;
  return <CloudOff size={15} />;
}
