/**
 * Scratch 式创作工坊的运行时：async/await 线程解释器。
 * - 绿旗 / 按键 / 点击角色三种帽子触发器
 * - run-token 取消：点红停或重新点绿旗时 token+1，旧线程在下一个
 *   await 点抛 StopError 自行退出（不残留定时器）
 * - 舞台坐标同 Scratch：x∈[-240,240]，y∈[-180,180]，0 度朝上、顺时针
 * - 画笔落在 480×360 的 canvas 上（Scratch 标准舞台分辨率）
 */
import { STAGE_W, STAGE_H, COSTUMES, compileSpriteScripts } from "./scratchBlocks.js";

const STEP_MS = 33; // 线程心跳，约 30fps
const DEG = Math.PI / 180;

class StopError extends Error {}

function normAngle(deg) {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

export function defaultSprite(index = 0) {
  const names = ["小猫", "小狗", "机器人", "独角兽", "火箭"];
  return {
    id: `sp-${Date.now()}-${Math.floor(Math.random() * 1e5)}-${index}`,
    name: names[index % names.length] || `角色${index + 1}`,
    costume: "🐱",
    x: index === 0 ? -40 : 60 * (index % 3),
    y: index === 0 ? -20 : 50 * (index % 2 === 0 ? 1 : -1),
    dir: 90,
    size: 100,
    visible: true,
    colorEffect: 0,
    penDown: false,
    penColor: "#4c97ff",
    penSize: 4,
    script: null, // Blockly 序列化 JSON
  };
}

/** 出场自带一段打招呼脚本，孩子点绿旗立刻有反应 */
export function starterScript() {
  return {
    variables: [],
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "sc_when_flag",
          id: "hat-hello",
          x: 40,
          y: 40,
          next: {
            block: {
              type: "sc_say_for",
              id: "say-hello",
              // 字段值用 Blockly save 的扁平格式：field_input 是字符串、field_number 是数字
              fields: { TEXT: "你好！我是小猫，点我试试～", SECS: 2 },
            },
          },
        },
        {
          type: "sc_when_clicked",
          id: "hat-click",
          x: 40,
          y: 180,
          next: {
            block: {
              type: "sc_next_costume",
              id: "next-c",
            },
          },
        },
      ],
    },
  };
}

export function defaultProject() {
  const sprite = defaultSprite(0);
  sprite.script = starterScript();
  return { version: 1, sprites: [sprite], variables: {} };
}

export class ScratchVM {
  constructor() {
    this.sprites = [];
    this.vars = {};
    this.running = false;
    this.token = 0;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.timerStart = performance.now();
    this.canvas = null;
    this.threads = []; // {spriteId, scriptId, token}
    this.onStateChange = null; // 运行状态变化时通知 React
  }

  attachCanvas(canvas) {
    this.canvas = canvas;
  }

  load(project) {
    this.stopAll(true);
    this.sprites = (project?.sprites || []).map((s) => ({
      ...defaultSprite(),
      ...s,
      sayMsg: "",
      sayType: "say",
      sayUntil: 0,
      _px: null,
      _py: null,
    }));
    this.vars = { ...(project?.variables || {}) };
  }

  toProject() {
    return {
      version: 1,
      variables: { ...this.vars },
      sprites: this.sprites.map((s) => {
        const { sayMsg, sayType, sayUntil, _px, _py, ...rest } = s;
        return { ...rest };
      }),
    };
  }

  _notify() {
    this.onStateChange?.(this.running);
  }

  _penCtx() {
    return this.canvas?.getContext("2d") || null;
  }

  sprite(id) {
    return this.sprites.find((s) => s.id === id) || null;
  }

  /* ---------- 触发 ---------- */

  greenFlag(activeSpriteId) {
    this.stopAll(true);
    this.running = true;
    this.timerStart = performance.now();
    this._notify();
    for (const sprite of this.sprites) {
      for (const script of compileSpriteScripts(sprite.script)) {
        if (script.hat === "flag") this._startThread(sprite, script);
      }
    }
    if (!this.sprites.some((s) => this._threadsOf(this.token).length)) {
      // 没有任何绿旗脚本也保持 running 态显示绿旗高亮，等红停复位
    }
  }

  stopAll(silent = false) {
    this.token += 1;
    this.running = false;
    this.threads = [];
    for (const sprite of this.sprites) {
      sprite.sayMsg = "";
      sprite.sayUntil = 0;
    }
    if (!silent) this._notify();
  }

  keyDown(key) {
    this.keys.add(key);
    if (!this.running) {
      this.running = true;
      this._notify();
    }
    for (const sprite of this.sprites) {
      for (const script of compileSpriteScripts(sprite.script)) {
        if (script.hat === "key" && script.key === key) this._startThread(sprite, script);
      }
    }
  }

  keyUp(key) {
    this.keys.delete(key);
  }

  spriteClicked(id) {
    const sprite = this.sprite(id);
    if (!sprite) return;
    if (!this.running) {
      this.running = true;
      this._notify();
    }
    for (const script of compileSpriteScripts(sprite.script)) {
      if (script.hat === "clicked") this._startThread(sprite, script);
    }
  }

  dragSprite(id, x, y) {
    const sprite = this.sprite(id);
    if (!sprite) return;
    this._moveTo(sprite, x, y);
  }

  setMouse(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  _threadsOf(token) {
    return this.threads.filter((t) => t.token === token);
  }

  _startThread(sprite, script) {
    // 同一脚本重复触发：像 Scratch 一样「重新开始」——掐掉旧线程
    this.threads = this.threads.filter((t) => !(t.spriteId === sprite.id && t.scriptId === script.topId));
    const myToken = this.token;
    this.threads.push({ spriteId: sprite.id, scriptId: script.topId, token: myToken });
    this._runThread(sprite, script, myToken);
  }

  async _runThread(sprite, script, myToken) {
    const alive = () => myToken === this.token;
    try {
      await this._execBody(script.body, sprite, alive);
    } catch (error) {
      if (!(error instanceof StopError)) console.warn("[scratch] 脚本出错:", error);
    } finally {
      this.threads = this.threads.filter((t) => !(t.spriteId === sprite.id && t.scriptId === script.topId && t.token === myToken));
    }
  }

  step(alive) {
    if (!alive()) throw new StopError("stopped");
    // 存活检查必须在定时器回调里再做一次：await 恢复时若只查调用时刻的状态，
    // 红停/重开绿旗后旧线程会多执行一步才退出
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!alive()) reject(new StopError("stopped"));
        else resolve();
      }, STEP_MS);
    });
  }

  async _sleepSeconds(secs, alive) {
    const total = Math.max(0, Math.min(60, secs)) * 1000;
    const until = Date.now() + total;
    while (Date.now() < until) {
      await this.step(alive);
    }
  }

  async _execBody(body, sprite, alive) {
    for (const cmd of body) {
      await this._execCmd(cmd, sprite, alive);
    }
  }

  _stagePos(sprite) {
    return { px: sprite._px, py: sprite._py };
  }

  _moveTo(sprite, x, y) {
    const ctx = this._penCtx();
    const { px, py } = this._stagePos(sprite);
    sprite.x = x;
    sprite.y = y;
    if (sprite.penDown && ctx) {
      const ax = px ?? x + STAGE_W / 2;
      const ay = py ?? y + STAGE_H / 2;
      ctx.strokeStyle = sprite.penColor;
      ctx.lineWidth = Math.max(1, sprite.penSize);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px ?? ax, py ?? ay);
      ctx.lineTo(x + STAGE_W / 2, y + STAGE_H / 2);
      ctx.stroke();
    }
    sprite._px = x + STAGE_W / 2;
    sprite._py = y + STAGE_H / 2;
  }

  _bounce(sprite) {
    const limit = 12;
    let bounced = false;
    if (sprite.x > STAGE_W / 2 - limit) { sprite.dir = 360 - sprite.dir; sprite.x = STAGE_W / 2 - limit; bounced = true; }
    else if (sprite.x < -STAGE_W / 2 + limit) { sprite.dir = 360 - sprite.dir; sprite.x = -STAGE_W / 2 + limit; bounced = true; }
    if (sprite.y > STAGE_H / 2 - limit) { sprite.dir = normAngle(180 - sprite.dir); sprite.y = STAGE_H / 2 - limit; bounced = true; }
    else if (sprite.y < -STAGE_H / 2 + limit) { sprite.dir = normAngle(180 - sprite.dir); sprite.y = -STAGE_H / 2 + limit; bounced = true; }
    return bounced;
  }

  async _execCmd(cmd, sprite, alive) {
    const num = (expr, fallback = 0) => {
      const v = this.evalExpr(expr, sprite);
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    switch (cmd.t) {
      case "move": {
        const steps = num(cmd.v, 10);
        this._moveTo(sprite, sprite.x + steps * Math.sin(sprite.dir * DEG), sprite.y + steps * Math.cos(sprite.dir * DEG));
        break;
      }
      case "turn":
        sprite.dir = normAngle(sprite.dir + num(cmd.deg, 15));
        break;
      case "point":
        sprite.dir = normAngle(num(cmd.deg, 90));
        break;
      case "goto":
        this._moveTo(sprite, num(cmd.x, 0), num(cmd.y, 0));
        break;
      case "changeXY":
        this._moveTo(sprite, sprite.x + num(cmd.dx, 0), sprite.y + num(cmd.dy, 0));
        break;
      case "glide": {
        const secs = Math.max(0, Math.min(30, num(cmd.secs, 1)));
        const tx = num(cmd.x, 0);
        const ty = num(cmd.y, 0);
        const sx = sprite.x;
        const sy = sprite.y;
        const start = Date.now();
        if (secs <= 0.01) { this._moveTo(sprite, tx, ty); break; }
        while (true) {
          const t = Math.min(1, (Date.now() - start) / (secs * 1000));
          this._moveTo(sprite, sx + (tx - sx) * t, sy + (ty - sy) * t);
          if (t >= 1) break;
          await this.step(alive);
        }
        break;
      }
      case "bounce":
        this._bounce(sprite);
        break;
      case "say": {
        const text = String(this.evalExpr(cmd.text, sprite) ?? "");
        sprite.sayMsg = text;
        sprite.sayType = cmd.think ? "think" : "say";
        sprite.sayUntil = cmd.secs == null ? Infinity : Date.now() + Math.max(0, Math.min(60, num(cmd.secs, 2))) * 1000;
        if (cmd.secs != null) {
          await this._sleepSeconds(num(cmd.secs, 2), alive);
          if (sprite.sayUntil !== Infinity && Date.now() >= sprite.sayUntil - 40) sprite.sayMsg = "";
        }
        break;
      }
      case "costume":
        sprite.costume = cmd.v;
        break;
      case "nextCostume": {
        const i = COSTUMES.indexOf(sprite.costume);
        sprite.costume = COSTUMES[(i + 1) % COSTUMES.length] || "🐱";
        break;
      }
      case "changeSize":
        sprite.size = Math.max(10, Math.min(300, sprite.size + num(cmd.v, 10)));
        break;
      case "setSize":
        sprite.size = Math.max(10, Math.min(300, num(cmd.v, 100)));
        break;
      case "show":
        sprite.visible = true;
        break;
      case "hide":
        sprite.visible = false;
        break;
      case "colorEffect":
        sprite.colorEffect = (sprite.colorEffect + num(cmd.v, 25)) % 360;
        break;
      case "clearEffects":
        sprite.colorEffect = 0;
        break;
      case "penClear": {
        const ctx = this._penCtx();
        if (ctx && this.canvas) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        break;
      }
      case "penDown":
        sprite.penDown = true;
        sprite._px = null;
        sprite._py = null;
        break;
      case "penUp":
        sprite.penDown = false;
        break;
      case "penColor":
        sprite.penColor = cmd.v;
        break;
      case "penSize":
        sprite.penSize = Math.max(1, Math.min(40, num(cmd.v, 4)));
        break;
      case "stamp": {
        const ctx = this._penCtx();
        if (ctx) {
          ctx.save();
          ctx.translate(sprite.x + STAGE_W / 2, sprite.y + STAGE_H / 2);
          ctx.rotate((sprite.dir - 90) * DEG);
          ctx.scale(sprite.size / 100, sprite.size / 100);
          ctx.font = "40px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sprite.costume, 0, 0);
          ctx.restore();
        }
        break;
      }
      case "wait":
        await this._sleepSeconds(num(cmd.secs, 1), alive);
        break;
      case "repeat": {
        const times = Math.max(0, Math.min(10000, Math.round(num(cmd.times, 10))));
        for (let i = 0; i < times; i += 1) {
          await this._execBody(cmd.body, sprite, alive);
          await this.step(alive);
        }
        break;
      }
      case "forever":
        while (true) {
          await this._execBody(cmd.body, sprite, alive);
          await this.step(alive);
        }
      case "if":
        if (this.isTruthy(this.evalExpr(cmd.cond, sprite))) await this._execBody(cmd.then, sprite, alive);
        else await this._execBody(cmd.otherwise, sprite, alive);
        break;
      case "waitUntil":
        while (!this.isTruthy(this.evalExpr(cmd.cond, sprite))) {
          await this.step(alive);
        }
        break;
      case "stopAll":
        this.stopAll();
        throw new StopError("stopped");
      case "resetTimer":
        this.timerStart = performance.now();
        break;
      case "setVar":
        this.vars[cmd.name] = this.evalExpr(cmd.v, sprite);
        break;
      case "changeVar": {
        const cur = Number(this.vars[cmd.name]) || 0;
        this.vars[cmd.name] = cur + num(cmd.v, 0);
        break;
      }
      default:
        break;
    }
  }

  evalExpr(expr, sprite) {
    if (!expr) return 0;
    switch (expr.k) {
      case "num": return expr.v;
      case "str": return expr.v;
      case "bool": return expr.v;
      case "var": return this.vars[expr.name] ?? 0;
      case "op": {
        const a = Number(this.evalExpr(expr.a, sprite)) || 0;
        const b = Number(this.evalExpr(expr.b, sprite)) || 0;
        switch (expr.op) {
          case "ADD": return a + b;
          case "MINUS": return a - b;
          case "MULTIPLY": return a * b;
          case "DIVIDE": return b === 0 ? 0 : a / b;
          case "POWER": return a ** b;
          default: return a + b;
        }
      }
      case "rand": {
        let a = Math.round(Number(this.evalExpr(expr.a, sprite)) || 0);
        let b = Math.round(Number(this.evalExpr(expr.b, sprite)) || 0);
        if (a > b) [a, b] = [b, a];
        return a + Math.floor(Math.random() * (b - a + 1));
      }
      case "cmp": {
        const rawA = this.evalExpr(expr.a, sprite);
        const rawB = this.evalExpr(expr.b, sprite);
        const bothNumeric = rawA !== "" && rawB !== "" && Number.isFinite(Number(rawA)) && Number.isFinite(Number(rawB));
        let result;
        if (bothNumeric) {
          const a = Number(rawA);
          const b = Number(rawB);
          result = expr.op === "EQ" ? a === b : expr.op === "LT" ? a < b : a > b;
        } else {
          const a = String(rawA).toLowerCase();
          const b = String(rawB).toLowerCase();
          result = expr.op === "EQ" ? a === b : expr.op === "LT" ? a < b : a > b;
        }
        return result;
      }
      case "logic": {
        const a = this.isTruthy(this.evalExpr(expr.a, sprite));
        const b = this.isTruthy(this.evalExpr(expr.b, sprite));
        return expr.op === "AND" ? a && b : a || b;
      }
      case "not": return !this.isTruthy(this.evalExpr(expr.a, sprite));
      case "join": return `${this.evalExpr(expr.a, sprite)}${this.evalExpr(expr.b, sprite)}`;
      case "key": return this.keys.has(expr.key);
      case "touchingEdge":
        return Math.abs(sprite.x) > STAGE_W / 2 - 16 || Math.abs(sprite.y) > STAGE_H / 2 - 16;
      case "mouseX": return Math.round(this.mouse.x);
      case "mouseY": return Math.round(this.mouse.y);
      case "timer": return Math.round(((performance.now() - this.timerStart) / 1000) * 10) / 10;
      default: return 0;
    }
  }

  isTruthy(v) {
    if (typeof v === "string") return v !== "" && v !== "0" && v.toLowerCase() !== "false";
    return Boolean(v);
  }
}
