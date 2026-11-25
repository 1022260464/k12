import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Trash2, Plus } from "lucide-react";
import ScratchStage from "./ScratchStage.jsx";
import ScratchWorkspace from "./ScratchWorkspace.jsx";
import { ScratchVM, defaultProject, defaultSprite } from "../../features/scratch/scratchVm.js";
import { COSTUMES, COSTUME_NAMES } from "../../features/scratch/scratchBlocks.js";

const PROJECT_VERSION = 1;

function readProject(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (value?.version === PROJECT_VERSION && Array.isArray(value.sprites) && value.sprites.length) {
      return value;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 从脚本 JSON 里收集变量名（给舞台监视器用），多角色合并去重 */
function collectVariableNames(sprites) {
  const names = [];
  for (const sprite of sprites) {
    for (const item of sprite.script?.variables || []) {
      if (item?.name && !names.includes(item.name)) names.push(item.name);
    }
  }
  return names;
}

/**
 * Scratch 式自由创作工坊：舞台 + 角色列 + 单角色脚本区。
 * 作品自动保存到本机 localStorage（visual-programming 云端接口只收关卡项目，
 * 自由创作没有对应关卡编码，等后端有通用作品存储再接）。
 */
export default function ScratchStudio({ identity }) {
  const storageKey = `k12-scratch-project:${identity}`;
  const vmRef = useRef(null);
  if (!vmRef.current) vmRef.current = new ScratchVM();
  const vm = vmRef.current;

  const [project, setProject] = useState(null); // {version, sprites, variables}
  const [activeId, setActiveId] = useState(null);
  const [running, setRunning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedTip, setSavedTip] = useState("作品会自动保存");
  const wsRef = useRef(null);

  const activeSprite = useMemo(
    () => project?.sprites.find((sprite) => sprite.id === activeId) || project?.sprites[0] || null,
    [project, activeId],
  );
  const monitors = useMemo(() => collectVariableNames(project?.sprites || []), [project]);

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    const initial = readProject(storageKey) || defaultProject();
    setProject(initial);
    setActiveId(initial.sprites[0]?.id || null);
    vm.load(initial);
    vm.onStateChange = (value) => setRunning(Boolean(value));
    return () => {
      vm.onStateChange = null;
    };
  }, [storageKey, vm]);

  function updateSprite(spriteId, patch, options) {
    setProject((current) => {
      const sprites = current.sprites.map((sprite) => (
        sprite.id === spriteId ? { ...sprite, ...patch } : sprite
      ));
      const next = { ...current, sprites };
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (options?.tip) setSavedTip(options.tip);
      return next;
    });
  }

  /* ---------- 运行控制 ---------- */

  function handleFlag() {
    if (!activeSprite) return;
    // 先把当前工作区脚本收进项目（onChange 有 400ms 防抖，点绿旗不能等它）
    const snapshot = wsRef.current?.snapshot?.() || activeSprite.script;
    const sprites = project.sprites.map((sprite) => (
      sprite.id === activeSprite.id && snapshot ? { ...sprite, script: snapshot } : sprite
    ));
    const next = { ...project, sprites };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setProject(next);
    vm.load(next);
    vm.greenFlag();
    setRunning(true);
  }

  function handleStop() {
    vm.stopAll();
    setRunning(false);
    // 把运行后的位置/造型等状态写回项目，刷新后保持 Scratch 习惯（角色停在哪就在哪）
    setProject((current) => {
      if (!current) return current;
      const sprites = current.sprites.map((sprite) => {
        const live = vm.sprite(sprite.id);
        if (!live) return sprite;
        return {
          ...sprite,
          x: Math.round(live.x),
          y: Math.round(live.y),
          dir: Math.round(live.dir),
          size: live.size,
          visible: live.visible,
          costume: live.costume,
          colorEffect: live.colorEffect,
          penDown: live.penDown,
          penColor: live.penColor,
          penSize: live.penSize,
        };
      });
      const next = { ...current, sprites };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  /* ---------- 角色管理 ---------- */

  function handleAddSprite(costume) {
    const sprite = defaultSprite(project.sprites.length);
    sprite.costume = costume;
    // 按造型起名；重名时像 Scratch 一样加编号（火箭、火箭2、火箭3…）
    const base = COSTUME_NAMES[costume] || sprite.name;
    const taken = new Set(project.sprites.map((item) => item.name));
    let name = base;
    for (let n = 2; taken.has(name); n += 1) name = `${base}${n}`;
    sprite.name = name;
    sprite.x = Math.round((Math.random() - 0.5) * 300);
    sprite.y = Math.round((Math.random() - 0.5) * 220);
    sprite.script = null;
    setPickerOpen(false);
    setProject((current) => {
      const next = { ...current, sprites: [...current.sprites, sprite] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    setActiveId(sprite.id);
  }

  function handleDeleteSprite(spriteId) {
    if (project.sprites.length <= 1) return;
    vm.stopAll();
    setRunning(false);
    setProject((current) => {
      const sprites = current.sprites.filter((sprite) => sprite.id !== spriteId);
      const next = { ...current, sprites };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
    if (activeId === spriteId) {
      const remaining = project.sprites.find((sprite) => sprite.id !== spriteId);
      setActiveId(remaining?.id || null);
    }
  }

  if (!project || !activeSprite) {
    return <section className="sc-studio"><p className="sc-loading">正在打开创作工坊…</p></section>;
  }

  return (
    <section className="sc-studio" aria-label="Scratch 式创作工坊">
      <div className="sc-studio-main">
        <ScratchStage
          vm={vm}
          spritesVersion={project.sprites.map((s) => s.id).join("|")}
          selectedId={activeSprite.id}
          onSelectSprite={setActiveId}
          running={running}
          onFlag={handleFlag}
          onStop={handleStop}
          monitors={monitors}
        />

        <div className="sc-sprite-rail" aria-label="角色列表">
          <div className="sc-sprite-cards">
            {project.sprites.map((sprite) => (
              <div
                key={sprite.id}
                className={`sc-sprite-card${sprite.id === activeSprite.id ? " active" : ""}`}
              >
                <button type="button" className="sc-sprite-main" onClick={() => setActiveId(sprite.id)}>
                  <span className="sc-sprite-emoji" role="img" aria-label={sprite.name}>{sprite.costume}</span>
                  <span className="sc-sprite-name">{sprite.name}</span>
                </button>
                {project.sprites.length > 1 && (
                  <button
                    type="button"
                    className="sc-sprite-delete"
                    title={`删除${sprite.name}`}
                    onClick={() => handleDeleteSprite(sprite.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <div className="sc-add-sprite">
              <button
                type="button"
                className="sc-sprite-card sc-add-button"
                onClick={() => setPickerOpen((value) => !value)}
              >
                <span className="sc-sprite-emoji"><Plus size={22} /></span>
                <span className="sc-sprite-name">添加角色</span>
              </button>
              {pickerOpen && (
                <div className="sc-costume-picker" role="menu">
                  {COSTUMES.map((costume) => (
                    <button key={costume} type="button" role="menuitem" onClick={() => handleAddSprite(costume)}>
                      {costume}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="sc-rail-tip">
            点角色换它的脚本；拖动角色改变位置；给每个角色配不同积木，它们会同时动！
          </p>
        </div>
      </div>

      <div className="sc-studio-editor">
        <ScratchWorkspace
          key={activeSprite.id}
          ref={wsRef}
          initialScript={activeSprite.script}
          onChange={(script) => updateSprite(activeSprite.id, { script })}
          onClear={() => setSavedTip("脚本已清空，重新搭一个吧")}
        />
        <aside className="sc-ideas" aria-label="创作点子">
          <strong>💡 试试这些点子</strong>
          <ol>
            <li>蓝色「移动」+ 橙色「重复」，让角色跑起来</li>
            <li>落笔 → 重复 4 次〔移动 100 步 → 右转 90 度〕画出正方形</li>
            <li>「当按下空格键」+「换成 🚀 造型」，一按键就变身</li>
            <li>多加几个角色，点绿旗看它们一起表演</li>
          </ol>
          <div className="sc-ideas-foot">
            <span><Save size={14} /> 作品已自动保存到本机</span>
          </div>
          <p className="sc-save-tip">{savedTip}</p>
        </aside>
      </div>
    </section>
  );
}
