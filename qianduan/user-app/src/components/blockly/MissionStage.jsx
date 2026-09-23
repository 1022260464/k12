import {
  Bot,
  BookOpen,
  Cat,
  CheckCircle2,
  Database,
  Dog,
  Flag,
  Gauge,
  Gamepad2,
  LoaderCircle,
  MapPinned,
  ScanSearch,
  Scale,
  ShieldCheck,
  Sparkles,
  Tags,
} from "lucide-react";

const THEME_META = {
  labeling: {
    kicker: "数据标注台",
    accent: "labeling",
    Icon: Tags,
    stationTitle: "标注台",
    stationHint: "给图片贴上正确标签",
  },
  predict: {
    kicker: "预测实验室",
    accent: "predict",
    Icon: ScanSearch,
    stationTitle: "预测窗",
    stationHint: "先训练，再猜神秘图片",
  },
  route: {
    kicker: "路线演练场",
    accent: "route",
    Icon: MapPinned,
    stationTitle: "数据站",
    stationHint: "用循环走到终点",
  },
  confidence: {
    kicker: "信心门槛",
    accent: "confidence",
    Icon: Gauge,
    stationTitle: "信心门",
    stationHint: "够把握再回答",
  },
  patrol: {
    kicker: "校园巡检",
    accent: "patrol",
    Icon: ShieldCheck,
    stationTitle: "巡检站",
    stationHint: "感知 · 决策 · 行动",
  },
  balance: {
    kicker: "公平数据站",
    accent: "balance",
    Icon: Scale,
    stationTitle: "均衡检查台",
    stationHint: "比较每个类别的数量",
  },
  quiz: {
    kicker: "AI 知识闯关",
    accent: "quiz",
    Icon: Gamepad2,
    stationTitle: "答题能量站",
    stationHint: "三道题，连续答对",
  },
  story: {
    kicker: "AI 互动绘本",
    accent: "story",
    Icon: BookOpen,
    stationTitle: "故事舞台",
    stationHint: "按顺序讲完三幕故事",
  },
};

export function MissionStage({ mission, stage, result, running, error }) {
  const themeKey = mission?.theme || "labeling";
  const theme = THEME_META[themeKey] || THEME_META.labeling;
  const ThemeIcon = theme.Icon;
  const progress = Math.min(100, Math.max(0, Number(stage.robotPosition) || 0));

  return (
    <section className={`blockly-stage-panel theme-${theme.accent}`} aria-label="任务运行舞台">
      <header>
        <div>
          <span className="blockly-panel-kicker">{theme.kicker}</span>
          <strong>{mission.title}</strong>
        </div>
        <span className={`blockly-runtime-state ${running ? "is-running" : ""}`}>
          {running ? <LoaderCircle className="spin-icon" size={14} /> : <Bot size={14} />}
          {running ? "正在执行" : "等待运行"}
        </span>
      </header>

      <div className={`blockly-stage-scene theme-${theme.accent}`}>
        <div className="blockly-stage-sky" aria-hidden="true">
          <span className="stage-cloud cloud-one" />
          <span className="stage-cloud cloud-two" />
          <span className="stage-sparkle sparkle-one"><Sparkles size={14} /></span>
          <span className="stage-sparkle sparkle-two"><Sparkles size={12} /></span>
        </div>

        {themeKey === "confidence" && (
          <div className="blockly-confidence-gate" aria-hidden="true">
            <Gauge size={18} />
            <span>信心门 {mission.runtimeConfig?.minimumThreshold || 80}%</span>
          </div>
        )}

        {themeKey === "predict" && (
          <div className="blockly-mystery-card" aria-hidden="true">
            <ScanSearch size={18} />
            <strong>神秘图片</strong>
            <small>{imageLabel(mission.runtimeConfig?.imageId || "mystery-cat")}</small>
          </div>
        )}

        {themeKey === "patrol" && (
          <div className="blockly-patrol-flag" aria-hidden="true">
            <Flag size={16} />
            <span>校园终点</span>
          </div>
        )}

        {themeKey === "quiz" && (
          <div className="blockly-quiz-card">
            <strong>AI 知识题</strong>
            <small>1. 训练图片 AI 需要什么？A 魔法 B 数据</small>
            <small>2. AI 没把握时应怎样？A 乱猜 B 说明不确定</small>
            <small>3. 两类数量相同更可能？A 均衡 B 偏向</small>
          </div>
        )}

        {themeKey === "story" && (
          <div className={`blockly-story-scene scene-${stage.currentScene || "classroom"}`}>
            <BookOpen size={18} />
            <span>{sceneLabel(stage.currentScene)}</span>
          </div>
        )}

        <div className="blockly-data-station">
          <ThemeIcon size={22} />
          <strong>{theme.stationTitle}</strong>
          <small>{stage.datasetCount ? `${stage.datasetCount} 条数据` : theme.stationHint}</small>
        </div>

        <div className={`blockly-robot${running ? " is-moving" : ""}`} style={{ left: `${progress}%` }}>
          {stage.speech && <span className="blockly-speech">{stage.speech}</span>}
          <span className="blockly-robot-body"><Bot size={34} /></span>
          <span className="blockly-robot-shadow" />
        </div>

        <div className="blockly-stage-track">
          {[0, 1, 2, 3, 4].map((step) => (
            <span key={step} className={progress >= step * 20 + 8 ? "passed" : ""} />
          ))}
        </div>
        <div className="blockly-stage-progress" style={{ width: `${progress}%` }} />
      </div>

      <div className="blockly-stage-metrics">
        {themeKey === "balance" ? (
          <>
            <article><Database size={17} /><div><small>已放入样本</small><strong>{stage.datasetCount || 0} 张</strong></div></article>
            <article><Scale size={17} /><div><small>均衡状态</small><strong>{stage.balanceStatus || "等待检查"}</strong></div></article>
            <article><ShieldCheck size={17} /><div><small>学习主题</small><strong>公平与偏差</strong></div></article>
          </>
        ) : themeKey === "quiz" ? (
          <>
            <article><ListChecksIcon /><div><small>已回答</small><strong>{stage.quizAnswered || 0}/3</strong></div></article>
            <article><Gamepad2 size={17} /><div><small>当前得分</small><strong>{stage.quizScore == null ? "等待提交" : `${stage.quizScore}/3`}</strong></div></article>
            <article><AwardIcon /><div><small>连胜目标</small><strong>3 题</strong></div></article>
          </>
        ) : themeKey === "story" ? (
          <>
            <article><BookOpen size={17} /><div><small>当前场景</small><strong>{sceneLabel(stage.currentScene)}</strong></div></article>
            <article><Sparkles size={17} /><div><small>故事结构</small><strong>三幕顺序</strong></div></article>
            <article><Bot size={17} /><div><small>主角</small><strong>AI 小机器人</strong></div></article>
          </>
        ) : (
          <>
        <article>
          <Database size={17} />
          <div><small>训练数据</small><strong>{stage.datasetCount ? `${stage.datasetCount} 张` : "还没有"}</strong></div>
        </article>
        <article>
          <CheckCircle2 size={17} />
          <div><small>模型状态</small><strong>{stage.trained ? "训练完成" : "等待训练"}</strong></div>
        </article>
        <article>
          <ScanSearch size={17} />
          <div>
            <small>预测结果</small>
            <strong>
              {predictionLabel(stage.prediction)}
              {stage.predictionConfidence != null ? ` · ${stage.predictionConfidence}%` : ""}
            </strong>
          </div>
        </article>
          </>
        )}
      </div>

      {stage.labels?.length > 0 && (
        <div className="blockly-labelled-data" aria-label="已标注图片">
          {stage.labels.map((item) => (
            <span key={item.imageId} className={item.category === "cat" ? "cat" : "dog"}>
              {item.category === "cat" ? <Cat size={15} /> : <Dog size={15} />}
              {imageLabel(item.imageId)}：{item.category === "cat" ? "猫" : "狗"}
            </span>
          ))}
        </div>
      )}

      {error && <p className="blockly-run-error" role="alert">{error}</p>}

      {result && (
        <div className={`blockly-result ${result.passed ? "passed" : "needs-work"}`}>
          <header>
            <strong>{result.passed ? "任务完成" : "再调整一下积木"}</strong>
            <span aria-label={`${result.stars} 颗星`}>
              {[1, 2, 3].map((star) => <i key={star} className={star <= result.stars ? "earned" : ""} />)}
            </span>
          </header>
          <ul>
            {result.checks.map((check) => (
              <li className={check.passed ? "passed" : ""} key={check.id}>
                <CheckCircle2 size={15} />{check.label}
              </li>
            ))}
          </ul>
          {result.passed && (
            <div className="blockly-result-learning">
              <strong>获得徽章：{mission.badge}</strong>
              <p>{mission.reflection}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function predictionLabel(value) {
  if (value === "cat") return "猫";
  if (value === "dog") return "狗";
  if (value === "unknown") return "无法判断";
  return "尚未预测";
}

function imageLabel(value) {
  const labels = {
    "cat-1": "猫图 1",
    "cat-2": "猫图 2",
    "dog-1": "狗图 1",
    "dog-2": "狗图 2",
    "mystery-cat": "神秘猫图",
    "mystery-dog": "校园小狗",
  };
  return labels[value] || value;
}

function sceneLabel(value) {
  const labels = { classroom: "AI 教室", lab: "AI 实验室", future: "未来城市" };
  return labels[value] || "等待第一幕";
}

function ListChecksIcon() {
  return <CheckCircle2 size={17} />;
}

function AwardIcon() {
  return <Sparkles size={17} />;
}
