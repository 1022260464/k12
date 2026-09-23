import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as Blockly from "blockly";
import * as ZhHans from "blockly/msg/zh-hans";
import { Play, RotateCcw, Save } from "lucide-react";
import { compileBlocklyWorkspace } from "../../features/blockly/blocklyRuntime.js";

Blockly.setLocale(ZhHans);
registerK12Blocks();

export const BlocklyWorkspace = forwardRef(function BlocklyWorkspace({
  mission,
  savedState,
  onChange,
  onRun,
}, ref) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const saveTimerRef = useRef(null);
  const [message, setMessage] = useState("积木会自动保存");

  useImperativeHandle(ref, () => ({
    run: () => runWorkspace(),
    reset: () => resetWorkspace(),
  }));

  useEffect(() => {
    if (!hostRef.current) return undefined;

    const workspace = Blockly.inject(hostRef.current, {
      toolbox: createToolbox(mission.toolboxCategories),
      renderer: "zelos",
      theme: K12_BLOCKLY_THEME,
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.86, maxScale: 1.25, minScale: 0.55, scaleSpeed: 1.1 },
      grid: { spacing: 24, length: 2, colour: "#dbe8ef", snap: false },
    });
    workspaceRef.current = workspace;

    if (savedState && typeof savedState === "object") {
      try {
        Blockly.serialization.workspaces.load(savedState, workspace);
      } catch {
        createStarterBlock(workspace);
        setMessage("旧进度无法读取，已创建新的任务");
      }
    } else {
      createStarterBlock(workspace);
    }

    const changeListener = (event) => {
      if (Blockly.Events.isUiEvent(event) || event.type === Blockly.Events.FINISHED_LOADING) return;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => saveWorkspace("已自动保存"), 350);
    };
    workspace.addChangeListener(changeListener);

    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(hostRef.current);
    Blockly.svgResize(workspace);

    return () => {
      window.clearTimeout(saveTimerRef.current);
      observer.disconnect();
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [mission.id]);

  function saveWorkspace(nextMessage = "进度已保存") {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    onChange?.(Blockly.serialization.workspaces.save(workspace));
    setMessage(nextMessage);
  }

  function resetWorkspace() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    workspace.clear();
    createStarterBlock(workspace);
    saveWorkspace("已重置当前关卡");
  }

  function runWorkspace() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    try {
      const commands = compileBlocklyWorkspace(workspace);
      const workspaceState = Blockly.serialization.workspaces.save(workspace);
      onChange?.(workspaceState);
      setMessage("积木检查通过，正在运行");
      onRun?.(commands, null, workspaceState);
    } catch (error) {
      setMessage(error.message || "积木暂时无法运行");
      onRun?.(null, error);
    }
  }

  return (
    <section className="blockly-editor-panel" aria-label="图形化编程工作区">
      <header>
        <div>
          <span className="blockly-panel-kicker">积木工作区</span>
          <strong>拖动积木，像搭积木一样完成任务</strong>
        </div>
        <div className="blockly-editor-actions">
          <span className="blockly-save-state"><Save size={13} />{message}</span>
          <button type="button" className="icon-button" title="重置关卡" onClick={resetWorkspace}><RotateCcw size={17} /></button>
          <button type="button" className="button primary" onClick={runWorkspace}><Play size={16} />运行积木</button>
        </div>
      </header>
      <div className="blockly-host" ref={hostRef} />
    </section>
  );
});

const K12_BLOCKLY_THEME = Blockly.Theme.defineTheme("k12-ai-lab", {
  base: Blockly.Themes.Classic,
  blockStyles: {
    event_blocks: { colourPrimary: "#f2b705", colourSecondary: "#d99f00", colourTertiary: "#a87900" },
    data_blocks: { colourPrimary: "#ef7d32", colourSecondary: "#d56520", colourTertiary: "#9f4814" },
    ai_blocks: { colourPrimary: "#16a394", colourSecondary: "#0f887b", colourTertiary: "#0a675d" },
    motion_blocks: { colourPrimary: "#2489c5", colourSecondary: "#1572ac", colourTertiary: "#105882" },
    looks_blocks: { colourPrimary: "#7b61b3", colourSecondary: "#654a9f", colourTertiary: "#4d3979" },
    fairness_blocks: { colourPrimary: "#0f9d78", colourSecondary: "#0b7d60", colourTertiary: "#075b46" },
    game_blocks: { colourPrimary: "#e45b8f", colourSecondary: "#c74476", colourTertiary: "#983154" },
    story_blocks: { colourPrimary: "#8b63c7", colourSecondary: "#7049ad", colourTertiary: "#563685" },
  },
  categoryStyles: {
    event_category: { colour: "#f2b705" },
    data_category: { colour: "#ef7d32" },
    ai_category: { colour: "#16a394" },
    logic_category: { colour: "#4c70ba" },
    control_category: { colour: "#d08b28" },
    motion_category: { colour: "#2489c5" },
    looks_category: { colour: "#7b61b3" },
    fairness_category: { colour: "#0f9d78" },
    game_category: { colour: "#e45b8f" },
    story_category: { colour: "#8b63c7" },
  },
  componentStyles: {
    workspaceBackgroundColour: "#f8fbfd",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#344054",
    flyoutBackgroundColour: "#f0f6f9",
    flyoutForegroundColour: "#344054",
    flyoutOpacity: 1,
    scrollbarColour: "#b7c9d3",
    insertionMarkerColour: "#1796d2",
    insertionMarkerOpacity: 0.35,
    cursorColour: "#1796d2",
  },
  fontStyle: { family: 'Inter, "Microsoft YaHei", sans-serif', weight: "600", size: 12 },
});

function registerK12Blocks() {
  const definitions = [
    {
      type: "k12_when_start",
      message0: "开始任务",
      nextStatement: null,
      style: "event_blocks",
      hat: "cap",
      tooltip: "程序从这里开始运行",
    },
    {
      type: "k12_label_image",
      message0: "给图片 %1 贴标签 %2",
      args0: [
        {
          type: "field_dropdown",
          name: "IMAGE",
          options: [["猫图片 1", "cat-1"], ["猫图片 2", "cat-2"], ["狗图片 1", "dog-1"], ["狗图片 2", "dog-2"]],
        },
        { type: "field_dropdown", name: "CATEGORY", options: [["猫", "cat"], ["狗", "dog"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "data_blocks",
      tooltip: "告诉 AI 这张图片属于哪个类别",
    },
    {
      type: "k12_train_classifier",
      message0: "训练图片分类器",
      previousStatement: null,
      nextStatement: null,
      style: "ai_blocks",
      tooltip: "让分类器从训练数据中寻找规律",
    },
    {
      type: "k12_predict_image",
      message0: "预测图片 %1",
      args0: [{ type: "field_dropdown", name: "IMAGE", options: [["神秘图片", "mystery-cat"], ["校园小狗", "mystery-dog"]] }],
      previousStatement: null,
      nextStatement: null,
      style: "ai_blocks",
      tooltip: "让训练后的分类器预测一张新图片",
    },
    {
      type: "k12_prediction_equals",
      message0: "预测结果是 %1",
      args0: [{ type: "field_dropdown", name: "CATEGORY", options: [["猫", "cat"], ["狗", "dog"]] }],
      output: "Boolean",
      style: "ai_blocks",
      tooltip: "判断最近一次预测是否等于指定类别",
    },
    {
      type: "k12_confidence_at_least",
      message0: "预测置信度至少 %1 %",
      args0: [{ type: "field_number", name: "THRESHOLD", value: 80, min: 50, max: 100, precision: 5 }],
      output: "Boolean",
      style: "ai_blocks",
      tooltip: "判断最近一次预测的置信度是否达到设定门槛",
    },
    {
      type: "k12_move",
      message0: "机器人前进 %1 步",
      args0: [{ type: "field_number", name: "STEPS", value: 2, min: 1, max: 10, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "让机器人向数据站移动",
    },
    {
      type: "k12_say",
      message0: "说 %1",
      args0: [{ type: "field_input", name: "MESSAGE", text: "任务完成" }],
      previousStatement: null,
      nextStatement: null,
      style: "looks_blocks",
      tooltip: "让机器人说一句话",
    },
    {
      type: "k12_check_balance",
      message0: "检查训练数据是否均衡",
      previousStatement: null,
      nextStatement: null,
      style: "fairness_blocks",
      tooltip: "比较各类别的样本数量，检查数据是否均衡",
    },
    {
      type: "k12_quiz_answer",
      message0: "回答 %1 选择 %2",
      args0: [
        { type: "field_dropdown", name: "QUESTION", options: [["第 1 题", "q1"], ["第 2 题", "q2"], ["第 3 题", "q3"]] },
        { type: "field_dropdown", name: "ANSWER", options: [["A", "a"], ["B", "b"], ["C", "c"], ["D", "d"]] },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "game_blocks",
      tooltip: "选择一道题并提交你的答案",
    },
    {
      type: "k12_submit_quiz",
      message0: "提交答案并计算得分",
      previousStatement: null,
      nextStatement: null,
      style: "game_blocks",
      tooltip: "提交全部答案，查看分数和反馈",
    },
    {
      type: "k12_switch_scene",
      message0: "切换到场景 %1",
      args0: [{
        type: "field_dropdown",
        name: "SCENE",
        options: [["AI 教室", "classroom"], ["AI 实验室", "lab"], ["未来城市", "future"]],
      }],
      previousStatement: null,
      nextStatement: null,
      style: "story_blocks",
      tooltip: "切换绘本故事的背景场景",
    },
    {
      type: "k12_wait",
      message0: "等待 %1 秒",
      args0: [{ type: "field_number", name: "SECONDS", value: 1, min: 1, max: 10, precision: 1 }],
      previousStatement: null,
      nextStatement: null,
      style: "story_blocks",
      tooltip: "让当前画面停留一段时间",
    },
  ];
  definitions.forEach((definition) => {
    if (!Blockly.Blocks[definition.type]) Blockly.common.defineBlocksWithJsonArray([definition]);
  });
}

function createStarterBlock(workspace) {
  const start = workspace.newBlock("k12_when_start");
  start.initSvg();
  start.render();
  start.moveBy(48, 48);
}

function createToolbox(categoryIds) {
  const categories = {
    events: {
      kind: "category", name: "开始", categorystyle: "event_category",
      contents: [{ kind: "block", type: "k12_when_start" }],
    },
    data: {
      kind: "category", name: "AI 数据", categorystyle: "data_category",
      contents: [{ kind: "block", type: "k12_label_image" }],
    },
    ai: {
      kind: "category", name: "AI 能力", categorystyle: "ai_category",
      contents: [
        { kind: "block", type: "k12_train_classifier" },
        { kind: "block", type: "k12_predict_image" },
        { kind: "block", type: "k12_prediction_equals" },
        { kind: "block", type: "k12_confidence_at_least" },
      ],
    },
    logic: {
      kind: "category", name: "判断", categorystyle: "logic_category",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "k12_prediction_equals" },
        { kind: "block", type: "k12_confidence_at_least" },
      ],
    },
    control: {
      kind: "category", name: "循环", categorystyle: "control_category",
      contents: [{
        kind: "block",
        type: "controls_repeat_ext",
        inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 4 } } } },
      }],
    },
    motion: {
      kind: "category", name: "行动", categorystyle: "motion_category",
      contents: [{ kind: "block", type: "k12_move" }],
    },
    looks: {
      kind: "category", name: "表达", categorystyle: "looks_category",
      contents: [{ kind: "block", type: "k12_say" }],
    },
    fairness: {
      kind: "category", name: "公平检查", categorystyle: "fairness_category",
      contents: [{ kind: "block", type: "k12_check_balance" }],
    },
    game: {
      kind: "category", name: "知识闯关", categorystyle: "game_category",
      contents: [
        { kind: "block", type: "k12_quiz_answer" },
        { kind: "block", type: "k12_submit_quiz" },
      ],
    },
    story: {
      kind: "category", name: "绘本故事", categorystyle: "story_category",
      contents: [
        { kind: "block", type: "k12_switch_scene" },
        { kind: "block", type: "k12_wait" },
      ],
    },
  };
  return { kind: "categoryToolbox", contents: categoryIds.map((id) => categories[id]).filter(Boolean) };
}
