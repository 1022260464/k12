import { useEffect, useRef, useState } from "react";
import { EXPERIENCE } from "../experience/experience.js";
import { visualsFor } from "../experience/visualAssets.js";

/** 悬浮入口：跳转到 AI 学习台主页面，避免与整页双开对话状态；可按住拖到屏幕任意位置（位置记忆）。 */

const POS_KEY = "k12-floating-assistant-pos";
const EDGE = 8;

function clampPos(x, y, width, height) {
  const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - height - EDGE);
  return {
    x: Math.min(Math.max(EDGE, x), maxX),
    y: Math.min(Math.max(EDGE, y), maxY),
  };
}

function readStoredPos() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(POS_KEY) || "null");
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) return raw;
  } catch { /* 存储坏了就回默认右下角 */ }
  return null;
}

export function FloatingAssistant({ page, session, navigate, onRequireLogin, experience = EXPERIENCE.TEEN }) {
  const [pos, setPos] = useState(readStoredPos);
  const asideRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const primary = experience === EXPERIENCE.PRIMARY;
  const assistantIcon = visualsFor(experience).mascot;

  // 挂载/窗口变化后把球夹回可视范围（比如上次拖在右侧、这次窗口变小）。
  useEffect(() => {
    const clampCurrent = () => setPos((current) => {
      if (!current || !asideRef.current) return current;
      const rect = asideRef.current.getBoundingClientRect();
      const next = clampPos(current.x, current.y, rect.width, rect.height);
      return next.x === current.x && next.y === current.y ? current : next;
    });
    clampCurrent();
    window.addEventListener("resize", clampCurrent);
    return () => window.removeEventListener("resize", clampCurrent);
  }, []);

  // 隐藏判定必须放在全部 hook 之后：本组件常驻页面之外，提前 return 会让
  // hook 数量在两次渲染间变化，切到 ai-studio 时触发 React #300 整树卸载（空白页）。
  if (page === "ai-studio") return null;

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault(); // 阻止 button 里 <img> 的原生拖拽抢占指针流（会发 pointercancel 吞掉后续 pointermove）
    const rect = asideRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      last: null, // 最近一次计算出的目标位置（DOM 可能还没刷出来，不能靠 rect 收尾）
    };
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = asideRef.current.getBoundingClientRect();
    const next = clampPos(event.clientX - drag.offsetX, event.clientY - drag.offsetY, rect.width, rect.height);
    if (!movedRef.current && (Math.abs(next.x - rect.left) > 3 || Math.abs(next.y - rect.top) > 3)) {
      movedRef.current = true; // 超过 3px 才算拖动，否则仍是点击
    }
    if (movedRef.current) {
      drag.last = next;
      setPos(next);
    }
  }

  function onPointerEnd(event) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!movedRef.current) return;
    // 优先用最后一次计算的位置，避免 React 还没把中间位置刷进 DOM 时读到旧 rect。
    const rect = asideRef.current.getBoundingClientRect();
    const final = drag.last || clampPos(rect.left, rect.top, rect.width, rect.height);
    setPos(final);
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(final));
    } catch { /* 存不了就只在本次会话生效 */ }
  }

  function onClick() {
    if (movedRef.current) { movedRef.current = false; return; } // 拖动收尾的那次 click 不跳转
    if (!session) {
      onRequireLogin();
      return;
    }
    navigate("ai-studio");
  }

  return (
    <aside
      ref={asideRef}
      className="floating-assistant"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      aria-label="打开 AI 学习台"
    >
      <button
        className="assistant-launcher"
        type="button"
        aria-label={primary ? "问问小智" : "打开 AI 学习台"}
        data-label={primary ? "问问小智" : "AI 学习台"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
      >
        <img src={assistantIcon} alt="" width={48} height={48} draggable={false} />
      </button>
    </aside>
  );
}
