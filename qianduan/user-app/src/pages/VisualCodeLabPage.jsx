import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Blocks,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Code2,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  Play,
  Star,
  Wifi,
} from "lucide-react";
import { BlocklyWorkspace } from "../components/blockly/BlocklyWorkspace.jsx";
import { MissionHoverPreview } from "../components/blockly/MissionHoverPreview.jsx";
import { MissionStage } from "../components/blockly/MissionStage.jsx";
import {
  BLOCKLY_STORAGE_VERSION,
  DEFAULT_BLOCKLY_MISSIONS,
  evaluateBlocklyMission,
  normalizeMission,
} from "../data/blocklyMissions.js";
import { visualProgrammingApi } from "../api/client.js";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

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
  const identity = session?.userId || session?.user?.username || "guest";
  const storageKey = `k12-blockly-lab:${identity}`;
  const [missions, setMissions] = useState(DEFAULT_BLOCKLY_MISSIONS);
  const [missionSource, setMissionSource] = useState("builtin");
  const [labState, setLabState] = useState(() => readLabState(storageKey));
  const [missionId, setMissionId] = useState(DEFAULT_BLOCKLY_MISSIONS[0].id);
  const [stage, setStage] = useState(EMPTY_STAGE);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [hoverMissionId, setHoverMissionId] = useState(null);
  const [syncState, setSyncState] = useState("local");
  const runRevisionRef = useRef(0);

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
    sessionStorage.removeItem("k12-visual-mission");
  }, [missions]);

  useEffect(() => {
    const next = readLabState(storageKey);
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
        const merged = mergeRemoteProjects(next, remote);
        localStorage.setItem(storageKey, JSON.stringify(merged));
        setLabState(merged);
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
          if (saved?.evaluation) evaluation = saved.evaluation;
          setSyncState("synced");
        } catch {
          setSyncState("local");
        }
      }
      setResult(evaluation);
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
  const visuals = visualsFor(experience);
  const nextMission = missions.find((item) => item.order > mission.order && !labState.completed[item.id])
    || missions.find((item) => !labState.completed[item.id] && item.id !== mission.id);

  return (
    <div className="page inner-page visual-code-lab-page">
      <section className="visual-lab-hero">
        <div>
          <p className="eyebrow"><Blocks size={15} /> {primary ? "小学高年级 · 图形化 AI 编程" : "AI 通识 · 可视化算法实验"}</p>
          <h1>{primary ? "AI 积木实验室" : "可视化 AI 实验室"}</h1>
          <p>{primary ? "拖动数据、判断和循环积木，帮助角色完成一关关 AI 任务。" : "通过可视化积木理解数据、判断与循环，再逐步过渡到真实代码。"}</p>
          <div className="visual-lab-summary">
            <span><CheckCircle2 size={15} />完成 {completedCount}/{missions.length} 关</span>
            <span><Star size={15} />获得 {earnedStars}/{missions.length * 3} 颗星</span>
            <span><CloudStateIcon state={syncState} />{syncLabel(syncState)}</span>
            {missionSource === "builtin" && (
              <span className="is-fallback"><CloudOff size={15} />使用内置课程</span>
            )}
          </div>
        </div>
        <div className="visual-lab-hero-art" aria-hidden="true">
          <img src={visuals.code} alt="" />
        </div>
      </section>

      {!session && (
        <section className="visual-lab-login">
          <LockKeyhole size={22} />
          <div>
            <strong>现在可以直接试玩</strong>
            <p>游客进度保存在本机；登录后可同步积木和闯关记录。</p>
          </div>
          <button className="button primary" type="button" onClick={() => requireLogin()}>登录并同步</button>
        </section>
      )}

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
        </div>
        <button className="visual-hint-button" type="button" onClick={() => setShowHint((value) => !value)}>
          <Lightbulb size={16} />{showHint ? mission.hint : "需要提示"}
        </button>
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
          mission={mission}
          savedState={labState.workspaces[mission.id]}
          onChange={saveWorkspace}
          onRun={runCommands}
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

      <section className="visual-lab-next">
        <div>
          <Code2 size={21} />
          <div>
            <strong>准备学习文字编程？</strong>
            <p>完成积木关卡后，可以进入 Python 实验查看相同逻辑的代码写法。</p>
          </div>
        </div>
        <button className="button" type="button" onClick={() => navigate("code-lab")}>
          打开 Python 实验 <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function SparklesIcon() {
  return <Award size={22} />;
}

function readLabState(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (value?.version === BLOCKLY_STORAGE_VERSION) {
      return { version: BLOCKLY_STORAGE_VERSION, workspaces: value.workspaces || {}, completed: value.completed || {} };
    }
  } catch {
    // ignore
  }
  return { version: BLOCKLY_STORAGE_VERSION, workspaces: {}, completed: {} };
}

function initialStage(mission) {
  const template = mission?.templateCode;
  if (["PREDICTION_BRANCH", "CONFIDENCE_GATE", "AGENT_PATROL"].includes(template)
    || ["predict-and-decide", "confidence-gate", "campus-ai-patrol"].includes(mission?.id)) {
    return { ...EMPTY_STAGE, datasetCount: 4, speech: "训练后试试神秘图片" };
  }
  return { ...EMPTY_STAGE, labels: [] };
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
    trace: [],
    stage() {
      return {
        robotPosition: this.robotPosition,
        speech: this.speech,
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
      this.speech = `已标注 ${imageId}`;
      this.trace.push({ type: "LABEL", imageId, category });
    },
    train() {
      const success = this.labels.size >= 2 && new Set(this.labels.values()).size >= 2;
      this.trained = success;
      this.speech = success ? "分类器训练完成" : "还需要更多不同类别的标签";
      this.trace.push({ type: "TRAIN", success, count: this.labels.size });
    },
    predict(imageId) {
      if (!this.trained) {
        this.prediction = "unknown";
        this.predictionConfidence = 0;
        this.speech = "请先训练分类器";
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
      this.speech = `预测：${prediction === "cat" ? "猫" : prediction === "dog" ? "狗" : "未知"}（${confidence}%）`;
      this.trace.push({ type: "PREDICT", imageId, prediction, confidence });
    },
    move(steps) {
      const value = Math.max(1, Number(steps) || 1);
      this.robotPosition = Math.min(86, this.robotPosition + value * 6);
      this.speech = `前进 ${value} 步`;
      this.trace.push({ type: "MOVE", steps: value });
    },
    say(message) {
      this.speech = String(message || "");
      this.trace.push({ type: "SAY", message: this.speech });
    },
    condition(expected, matched) {
      this.trace.push({ type: "CONDITION", expected, matched: Boolean(matched) });
    },
    confidenceCondition(threshold, matched) {
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
      this.speech = balanced ? "两类数据一样多，更公平" : "再补充较少的那一类";
      this.trace.push({ type: "BALANCE_CHECK", balanced, counts });
    },
    quizAnswer(questionId, answer) {
      this.quizAnswers.set(questionId, answer);
      this.speech = `已记录${questionId.replace("q", "第 ")}题答案`;
      this.trace.push({ type: "QUIZ_ANSWER", questionId, answer });
    },
    quizSubmit() {
      const expected = config.expectedAnswers || ["b", "b", "a"];
      this.quizScore = expected.reduce((total, answer, index) => (
        total + (this.quizAnswers.get(`q${index + 1}`) === answer ? 1 : 0)
      ), 0);
      this.speech = `答对 ${this.quizScore} 题，继续加油！`;
      this.trace.push({ type: "QUIZ_SUBMIT", score: this.quizScore });
    },
    switchScene(sceneId) {
      this.currentScene = sceneId;
      const labelsByScene = { classroom: "AI 教室", lab: "AI 实验室", future: "未来城市" };
      this.speech = `来到${labelsByScene[sceneId] || sceneId}`;
      this.trace.push({ type: "SCENE", sceneId });
    },
    wait(seconds) {
      const value = Math.min(10, Math.max(1, Number(seconds) || 1));
      this.speech = `画面停留 ${value} 秒`;
      this.trace.push({ type: "WAIT", seconds: value });
    },
  };
  return runtime;
}

async function executeCommands(commands, runtime, onStage) {
  for (const command of commands) {
    await sleep(220);
    switch (String(command.type || "").toUpperCase()) {
      case "LABEL":
        runtime.label(command.imageId, command.category);
        break;
      case "TRAIN":
        runtime.train();
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
  }
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
