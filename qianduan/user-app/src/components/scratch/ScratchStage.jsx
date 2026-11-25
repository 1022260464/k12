import { useEffect, useRef } from "react";
import { Flag, Square } from "lucide-react";
import { STAGE_W, STAGE_H } from "../../features/scratch/scratchBlocks.js";

/**
 * Scratch 式舞台：白底 4:3，角色是 DOM 元素（rAF 每帧按 vm 状态摆位），
 * 画笔是底层 480×360 canvas。支持拖拽角色、点击角色、鼠标坐标侦测。
 */
export default function ScratchStage({ vm, spritesVersion, selectedId, onSelectSprite, running, onFlag, onStop, monitors = [] }) {
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const dragRef = useRef(null); // {id, moved, startX, startY, origX, origY}
  const boxRef = useRef(null);

  // canvas 挂给 vm；清一次底
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.width = STAGE_W;
    canvas.height = STAGE_H;
    canvas.getContext("2d").clearRect(0, 0, STAGE_W, STAGE_H);
    vm.attachCanvas(canvas);
    return () => vm.attachCanvas(null);
  }, [vm]);

  // rAF 同步：不经过 React，每帧只写 style，跑 forever 循环也不卡
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const layer = layerRef.current;
      const box = boxRef.current;
      if (!layer || !box) return;
      const rect = box.getBoundingClientRect();
      const sx = rect.width / STAGE_W;
      const sy = rect.height / STAGE_H;
      const nodes = layer.children;
      for (let i = 0; i < vm.sprites.length; i += 1) {
        const sprite = vm.sprites[i];
        const node = nodes[i];
        if (!node) continue;
        const left = ((sprite.x + STAGE_W / 2) / STAGE_W) * 100;
        const top = ((STAGE_H / 2 - sprite.y) / STAGE_H) * 100;
        node.style.left = `${left}%`;
        node.style.top = `${top}%`;
        node.style.display = sprite.visible ? "" : "none";
        node.style.zIndex = sprite.id === selectedId ? "3" : "2";
        const body = node.firstElementChild;
        if (body) {
          body.style.transform = `translate(-50%, -50%) rotate(${sprite.dir - 90}deg) scale(${sprite.size / 100})`;
          body.style.filter = sprite.colorEffect ? `hue-rotate(${sprite.colorEffect}deg)` : "";
        }
        const bubble = node.querySelector(".sc-bubble");
        if (bubble) {
          const expired = Date.now() > sprite.sayUntil;
          const text = expired ? "" : sprite.sayMsg;
          bubble.style.display = text ? "" : "none";
          if (text) {
            bubble.textContent = text;
            bubble.classList.toggle("think", sprite.sayType === "think");
          }
        }
      }
      // 变量监视器
      const monitorLayer = box.querySelector(".sc-monitors");
      if (monitorLayer) {
        for (const child of monitorLayer.children) {
          const name = child.dataset.name;
          const valueEl = child.querySelector("b");
          if (valueEl) valueEl.textContent = String(vm.vars[name] ?? 0);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [vm, selectedId]);

  /* ---------- 指针交互 ---------- */

  const stagePoint = (event) => {
    const rect = boxRef.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * STAGE_W - STAGE_W / 2,
      y: STAGE_H / 2 - ((event.clientY - rect.top) / rect.height) * STAGE_H,
    };
  };

  const onPointerDown = (event, spriteId) => {
    event.preventDefault();
    event.stopPropagation();
    const sprite = vm.sprite(spriteId);
    if (!sprite) return;
    onSelectSprite?.(spriteId);
    dragRef.current = {
      id: spriteId,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      origX: sprite.x,
      origY: sprite.y,
    };
  };

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(event.clientX - drag.startX) > 5 || Math.abs(event.clientY - drag.startY) > 5) {
        drag.moved = true;
        const p = stagePoint(event);
        vm.dragSprite(drag.id, p.x, p.y);
      }
      const p = stagePoint(event);
      vm.setMouse(p.x, p.y);
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      // 没怎么动的按下=点击角色，触发「当角色被点击」
      if (drag && !drag.moved) vm.spriteClicked(drag.id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [vm]);

  const onStageMouseMove = (event) => {
    const p = stagePoint(event);
    vm.setMouse(p.x, p.y);
  };

  return (
    <div className={`sc-stage-wrap${running ? " running" : ""}`}>
      <div className="sc-stage-toolbar">
        <button type="button" className="sc-flag" title="绿旗：开始运行" onClick={onFlag}><Flag size={18} /></button>
        <button type="button" className="sc-stop" title="红停：全部停下" onClick={onStop}><Square size={16} /></button>
        <span className="sc-stage-hint">点绿旗运行，红停停止；可以直接拖动角色</span>
      </div>
      <div className="sc-stage" ref={boxRef} onMouseMove={onStageMouseMove}>
        <canvas ref={canvasRef} className="sc-pen-canvas" aria-hidden="true" />
        <div className="sc-sprite-layer" ref={layerRef}>
          {vm.sprites.map((sprite) => (
            <div
              key={sprite.id}
              className={`sc-sprite-anchor${sprite.id === selectedId ? " selected" : ""}`}
              onPointerDown={(event) => onPointerDown(event, sprite.id)}
            >
              <span className="sc-sprite-body" role="img" aria-label={sprite.name}>{sprite.costume}</span>
              <div className="sc-bubble" style={{ display: "none" }} />
            </div>
          ))}
        </div>
        <div className="sc-monitors" aria-hidden={monitors.length === 0}>
          {monitors.map((name) => (
            <div key={name} className="sc-monitor" data-name={name}>
              <span>{name}</span>
              <b>0</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
