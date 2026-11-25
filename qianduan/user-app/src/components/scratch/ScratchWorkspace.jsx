import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as Blockly from "blockly";
import * as ZhHans from "blockly/msg/zh-hans";
import { SCRATCH_BLOCK_DEFS, SCRATCH_TOOLBOX } from "../../features/scratch/scratchBlocks.js";
import { Trash2 } from "lucide-react";

Blockly.setLocale(ZhHans);

if (!Blockly.Blocks.sc_when_flag) {
  Blockly.common.defineBlocksWithJsonArray(SCRATCH_BLOCK_DEFS());
}

const SCRATCH_THEME = Blockly.Theme.defineTheme("sc-studio", {
  base: Blockly.Themes.Zelos,
  blockStyles: {
    sc_event: { colourPrimary: "#ffbf00", colourSecondary: "#e6ac00", colourTertiary: "#cc9900" },
    sc_motion: { colourPrimary: "#4c97ff", colourSecondary: "#4280d7", colourTertiary: "#3373cc" },
    sc_looks: { colourPrimary: "#9966ff", colourSecondary: "#855cd6", colourTertiary: "#774dcb" },
    sc_control: { colourPrimary: "#ffab19", colourSecondary: "#ec9c13", colourTertiary: "#cf8b17" },
    sc_sensing: { colourPrimary: "#5cb1d6", colourSecondary: "#47a8d1", colourTertiary: "#2e8eb8" },
    sc_pen: { colourPrimary: "#0fbd8c", colourSecondary: "#0da57a", colourTertiary: "#0b8e69" },
    sc_operators: { colourPrimary: "#59c059", colourSecondary: "#46b946", colourTertiary: "#389438" },
    sc_data: { colourPrimary: "#ff8c1a", colourSecondary: "#ff8000", colourTertiary: "#db6e00" },
    math_blocks: { colourPrimary: "#59c059", colourSecondary: "#46b946", colourTertiary: "#389438" },
    logic_blocks: { colourPrimary: "#59c059", colourSecondary: "#46b946", colourTertiary: "#389438" },
    text_blocks: { colourPrimary: "#4c97ff", colourSecondary: "#4280d7", colourTertiary: "#3373cc" },
    variable_blocks: { colourPrimary: "#ff8c1a", colourSecondary: "#ff8000", colourTertiary: "#db6e00" },
    variable_dynamic_blocks: { colourPrimary: "#ff8c1a", colourSecondary: "#ff8000", colourTertiary: "#db6e00" },
    loop_blocks: { colourPrimary: "#ffab19", colourSecondary: "#ec9c13", colourTertiary: "#cf8b17" },
    list_blocks: { colourPrimary: "#ff6680", colourSecondary: "#ff4d6d", colourTertiary: "#db3355" },
  },
  categoryStyles: {
    sc_event: { colour: "#ffbf00" },
    sc_motion: { colour: "#4c97ff" },
    sc_looks: { colour: "#9966ff" },
    sc_control: { colour: "#ffab19" },
    sc_sensing: { colour: "#5cb1d6" },
    sc_pen: { colour: "#0fbd8c" },
    sc_operators: { colour: "#59c059" },
    sc_data: { colour: "#ff8c1a" },
  },
  componentStyles: {
    workspaceBackgroundColour: "#f4f8fb",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#344054",
    flyoutBackgroundColour: "#f0f6f9",
    flyoutForegroundColour: "#344054",
    flyoutOpacity: 1,
    scrollbarColour: "#b7c9d3",
    insertionMarkerColour: "#4c97ff",
    insertionMarkerOpacity: 0.4,
    cursorColour: "#4c97ff",
  },
  fontStyle: { family: 'Inter, "Microsoft YaHei", sans-serif', weight: "600", size: 12 },
});

/**
 * 单个角色的脚本工作区。切换角色时父组件用 key 重挂载，
 * 脚本 JSON 由父组件持久化（onChange 防抖 400ms）。
 */
export default forwardRef(function ScratchWorkspace({ initialScript, onChange, onClear }, ref) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const timerRef = useRef(null);
  const [message, setMessage] = useState("脚本会自动保存");

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const workspace = Blockly.inject(hostRef.current, {
      toolbox: SCRATCH_TOOLBOX(),
      renderer: "zelos",
      theme: SCRATCH_THEME,
      trashcan: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 1.2, minScale: 0.5, scaleSpeed: 1.1 },
      grid: { spacing: 26, length: 2, colour: "#dde8f0", snap: false },
    });
    workspaceRef.current = workspace;

    if (initialScript && typeof initialScript === "object") {
      try {
        Blockly.serialization.workspaces.load(initialScript, workspace);
      } catch {
        // 和任务实验室同款保险：反序列化失败不能留下半份程序
        workspace.clear();
        setMessage("旧脚本读不了，已清空，重新搭一个吧");
      }
    }

    const listener = (event) => {
      if (event.isUiEvent || event.type === Blockly.Events.FINISHED_LOADING) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const state = Blockly.serialization.workspaces.save(workspace);
        onChange?.(state);
        setMessage("已自动保存");
      }, 400);
    };
    workspace.addChangeListener(listener);
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(hostRef.current);
    Blockly.svgResize(workspace);

    return () => {
      window.clearTimeout(timerRef.current);
      observer.disconnect();
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    /** 立刻取当前脚本 JSON（点绿旗前调用，避免等 400ms 防抖） */
    snapshot: () => {
      const workspace = workspaceRef.current;
      return workspace ? Blockly.serialization.workspaces.save(workspace) : null;
    },
  }));

  return (
    <section className="sc-editor-panel" aria-label="角色脚本工作区">
      <header>
        <div>
          <span className="sc-panel-kicker">脚本区</span>
          <strong>从左边拖积木过来，给这个角色编程序</strong>
        </div>
        <div className="sc-editor-actions">
          <span className="sc-save-state">{message}</span>
          <button
            type="button"
            className="icon-button"
            title="清空这个角色的脚本"
            onClick={() => {
              const workspace = workspaceRef.current;
              if (!workspace) return;
              workspace.clear();
              onChange?.(Blockly.serialization.workspaces.save(workspace));
              setMessage("脚本已清空");
              onClear?.();
            }}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>
      <div className="sc-blockly-host" ref={hostRef} />
    </section>
  );
});
