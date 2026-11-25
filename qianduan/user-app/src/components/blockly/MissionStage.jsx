import {
  Bot,
  BookOpen,
  Cat,
  CheckCircle2,
  CircleAlert,
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
  const fx = stage.fx || null;
  const pose = stage.pose || "idle";

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

        {themeKey === "story" && (
          <>
            {/* 绘本三幕背景：切场景时交叉淡入 */}
            <div className="blockly-story-backdrops" aria-hidden="true">
              {["classroom", "lab", "future"].map((sceneId) => (
                <div
                  key={sceneId}
                  className={`story-backdrop backdrop-${sceneId}${(stage.currentScene || "classroom") === sceneId ? " active" : ""}`}
                />
              ))}
            </div>
            <div className={`blockly-story-scene scene-${stage.currentScene || "classroom"}`}>
              <BookOpen size={18} />
              <span>{sceneLabel(stage.currentScene)}</span>
            </div>
            {fx?.kind === "scene" && (
              <span key={fx.id} className="k2-scene-banner">{sceneLabel(fx.sceneId)}</span>
            )}
          </>
        )}

        {themeKey === "confidence" && (
          <div className="blockly-confidence-gate" aria-hidden="true">
            <Gauge size={18} />
            <span>信心门 {mission.runtimeConfig?.minimumThreshold || 80}%</span>
          </div>
        )}

        {themeKey === "predict" && (
          <div
            key={`mystery-${fx?.id || 0}`}
            className={`blockly-mystery-card${fx?.kind === "predict" ? " revealed" : ""}`}
            aria-hidden="true"
          >
            {fx?.kind === "predict" ? (
              <span className="k2-mystery-reveal">
                <strong>{fx.prediction === "cat" ? "🐱 是猫！" : fx.prediction === "dog" ? "🐶 是狗！" : "❓ 猜不出"}</strong>
                <small>把握 {fx.confidence ?? 0}%</small>
              </span>
            ) : (
              <>
                <ScanSearch size={18} />
                <strong>神秘图片</strong>
                <small>{imageLabel(mission.runtimeConfig?.imageId || "mystery-cat")}</small>
              </>
            )}
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
            {[
              { id: "q1", text: "1. 训练图片 AI 需要什么？A 魔法 B 数据" },
              { id: "q2", text: "2. AI 没把握时应怎样？A 乱猜 B 说明不确定" },
              { id: "q3", text: "3. 两类数量相同更可能？A 均衡 B 偏向" },
            ].map((question) => (
              <small
                key={question.id}
                className={fx?.kind === "quiz" && fx.questionId === question.id ? "picked" : ""}
              >
                {question.text}
              </small>
            ))}
            {fx?.kind === "quizScore" && (
              <span key={fx.id} className="k2-quiz-score">答对 {fx.score} / 3 题！</span>
            )}
          </div>
        )}

        <div className={`blockly-data-station${fx?.kind === "train" ? " is-learning" : ""}`}>
          {fx?.kind === "train" ? <LoaderCircle className="spin-icon" size={22} /> : <ThemeIcon size={22} />}
          <strong>{theme.stationTitle}</strong>
          <small>
            {fx?.kind === "train"
              ? "学习中…"
              : stage.datasetCount
                ? `${stage.datasetCount} 条数据`
                : theme.stationHint}
          </small>
        </div>

        <div className={`blockly-robot pose-${pose}`} style={{ left: `${progress}%` }}>
          {stage.speech && (
            <span key={`speech-${fx?.id || 0}`} className="blockly-speech">{stage.speech}</span>
          )}
          <RobotSprite pose={pose} />
          <span className="blockly-robot-shadow" />
        </div>

        {fx?.kind === "label" && (
          <span key={fx.id} className={`k2-fx-chip ${fx.category === "cat" ? "cat" : "dog"}`}>
            {fx.category === "cat" ? "🐱" : "🐶"} {imageLabel(fx.imageId)} 是 {fx.category === "cat" ? "猫" : "狗"}
          </span>
        )}

        {fx?.kind === "celebrate" && (
          <div key={fx.id} className="k2-confetti" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => (
              <i key={index} style={{ "--i": index }} />
            ))}
          </div>
        )}

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
              <li className={check.passed ? "passed" : "failed"} key={check.id}>
                {check.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                <div>
                  <span>{check.label}</span>
                  {!check.passed && check.advice && (
                    <small className="blockly-check-advice">下一步：{check.advice}</small>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!result.passed && result.checks.some((check) => !check.passed && check.advice) && (
            <p className="blockly-result-tip">按上面的「下一步」改积木，再点运行积木试试。</p>
          )}
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

/** Scratch 式小机器人角色：走路弹跳、思考闪天线、难过撇嘴、睡觉眯眼、通关欢呼。
 * pose 由运行时按积木动作实时下发（idle/walking/thinking/happy/sad/sleep/cheer）。 */
function RobotSprite({ pose }) {
  return (
    <span className={`k2-sprite ${pose}`}>
      <svg viewBox="0 0 72 58" aria-hidden="true">
        <line className="k2-antenna" x1="36" y1="5" x2="36" y2="14" />
        <circle className="k2-antenna-ball" cx="36" cy="5" r="3.6" />
        <rect className="k2-shell" x="15" y="14" width="42" height="34" rx="14" />
        <circle className="k2-eye" cx="29" cy="28" r="3.4" />
        <circle className="k2-eye" cx="43" cy="28" r="3.4" />
        <circle className="k2-cheek" cx="23.5" cy="34" r="2.6" />
        <circle className="k2-cheek" cx="48.5" cy="34" r="2.6" />
        <path className="k2-smile" d="M29 34.5 Q36 40 43 34.5" />
        <circle className="k2-foot k2-foot-a" cx="27" cy="51" r="4.2" />
        <circle className="k2-foot k2-foot-b" cx="45" cy="51" r="4.2" />
      </svg>
    </span>
  );
}
