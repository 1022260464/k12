/**
 * Scratch 式创作工坊：积木定义 + 工具箱 + 序列化 JSON 编译器。
 * 所有 Scratch 专属积木用 sc_ 前缀；运算/变量复用 Blockly 核心块
 * （math_arithmetic / math_random_int / logic_compare / variables_* 等）。
 * 编译器直接吃 Blockly 序列化 JSON（不依赖 workspace 实例），
 * 因此每个角色的脚本都能离线编译（只有活动角色的 workspace 在内存里）。
 */

export const STAGE_W = 480;
export const STAGE_H = 360;

/** 角色造型库（emoji 即造型，切换即时可见） */
export const COSTUMES = [
  "🐱", "🐶", "🤖", "🦄", "🚀", "🐟", "🐙", "🦋",
  "🐝", "🐢", "🐭", "🐰", "🦖", "👸", "🤠", "⚽",
];

/** 造型 → 默认角色名（新增角色按造型起名，和 Scratch 习惯一致） */
export const COSTUME_NAMES = {
  "🐱": "小猫", "🐶": "小狗", "🤖": "机器人", "🦄": "独角兽",
  "🚀": "火箭", "🐟": "小鱼", "🐙": "章鱼", "🦋": "蝴蝶",
  "🐝": "蜜蜂", "🐢": "乌龟", "🐭": "小鼠", "🐰": "小兔",
  "🦖": "恐龙", "👸": "公主", "🤠": "牛仔", "⚽": "足球",
};

export const KEY_OPTIONS = [
  ["空格", "space"], ["↑", "up"], ["↓", "down"], ["←", "left"], ["→", "right"],
];

export const PEN_COLOR_OPTIONS = [
  ["红色", "#ff4d6d"], ["橙色", "#ff9f1c"], ["黄色", "#ffd60a"], ["绿色", "#2dc653"],
  ["青色", "#0fbd8c"], ["蓝色", "#4c97ff"], ["紫色", "#9966ff"], ["粉色", "#ff6680"],
  ["棕色", "#8b5a2b"], ["黑色", "#333333"],
];

const NUM = (name, value) => ({ type: "field_number", name, value });

/** 定义全部 sc_ 积木（JSON 定义，跟 k12 积木同一套注册方式） */
export function SCRATCH_BLOCK_DEFS() {
  return [
    // ---- 事件 ----
    { type: "sc_when_flag", message0: "当 🟩 被点击", nextStatement: null, style: "sc_event", hat: "cap", tooltip: "点舞台上的绿旗，从这里开始运行" },
    {
      type: "sc_when_key", message0: "当按下 %1 键", nextStatement: null, style: "sc_event", hat: "cap",
      args0: [{ type: "field_dropdown", name: "KEY", options: KEY_OPTIONS }],
      tooltip: "按下对应的键盘按键，脚本就开始运行",
    },
    { type: "sc_when_clicked", message0: "当角色被点击", nextStatement: null, style: "sc_event", hat: "cap", tooltip: "在舞台上点一下这个角色，脚本就开始运行" },

    // ---- 运动 ----
    { type: "sc_move", message0: "移动 %1 步", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("STEPS", 10)], tooltip: "朝角色面朝的方向前进" },
    { type: "sc_turn_right", message0: "右转 %1 度", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("DEG", 15)] },
    { type: "sc_turn_left", message0: "左转 %1 度", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("DEG", 15)] },
    {
      type: "sc_goto", message0: "移到 x:%1 y:%2", previousStatement: null, nextStatement: null, style: "sc_motion",
      args0: [NUM("X", 0), NUM("Y", 0)], tooltip: "舞台中心是 (0,0)，最右是 240，最上是 180",
    },
    { type: "sc_glide", message0: "在 %1 秒内滑行到 x:%2 y:%3", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("SECS", 1), NUM("X", 100), NUM("Y", 0)] },
    { type: "sc_point", message0: "面向 %1 度方向", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("DEG", 90)], tooltip: "90=向右，0=向上，180=向左" },
    { type: "sc_bounce", message0: "碰到边缘就反弹", previousStatement: null, nextStatement: null, style: "sc_motion" },
    { type: "sc_change_x", message0: "将 x 坐标增加 %1", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("DX", 10)] },
    { type: "sc_change_y", message0: "将 y 坐标增加 %1", previousStatement: null, nextStatement: null, style: "sc_motion", args0: [NUM("DY", 10)] },

    // ---- 外观 ----
    { type: "sc_say", message0: "说 %1", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [{ type: "field_input", name: "TEXT", text: "你好！" }] },
    { type: "sc_say_for", message0: "说 %1 %2 秒", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [{ type: "field_input", name: "TEXT", text: "你好！" }, NUM("SECS", 2)] },
    { type: "sc_think_for", message0: "思考 %1 %2 秒", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [{ type: "field_input", name: "TEXT", text: "嗯…" }, NUM("SECS", 2)] },
    {
      type: "sc_switch_costume", message0: "换成 %1 造型", previousStatement: null, nextStatement: null, style: "sc_looks",
      args0: [{ type: "field_dropdown", name: "COSTUME", options: COSTUMES.map((c) => [c, c]) }],
    },
    { type: "sc_next_costume", message0: "下一个造型", previousStatement: null, nextStatement: null, style: "sc_looks" },
    { type: "sc_change_size", message0: "将大小增加 %1", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [NUM("DS", 10)] },
    { type: "sc_set_size", message0: "将大小设为 %1 %", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [NUM("S", 100)] },
    { type: "sc_show", message0: "显示", previousStatement: null, nextStatement: null, style: "sc_looks" },
    { type: "sc_hide", message0: "隐藏", previousStatement: null, nextStatement: null, style: "sc_looks" },
    { type: "sc_color_effect", message0: "将颜色特效增加 %1", previousStatement: null, nextStatement: null, style: "sc_looks", args0: [NUM("D", 25)], tooltip: "让角色变色，试试放进重复执行里" },
    { type: "sc_clear_effects", message0: "清除所有特效", previousStatement: null, nextStatement: null, style: "sc_looks" },

    // ---- 画笔 ----
    { type: "sc_pen_clear", message0: "全部擦除", previousStatement: null, nextStatement: null, style: "sc_pen" },
    { type: "sc_pen_down", message0: "落笔", previousStatement: null, nextStatement: null, style: "sc_pen", tooltip: "之后角色移动就会画出线" },
    { type: "sc_pen_up", message0: "抬笔", previousStatement: null, nextStatement: null, style: "sc_pen" },
    { type: "sc_pen_color", message0: "将笔颜色设为 %1", previousStatement: null, nextStatement: null, style: "sc_pen", args0: [{ type: "field_dropdown", name: "COLOR", options: PEN_COLOR_OPTIONS }] },
    { type: "sc_pen_size", message0: "将笔粗细设为 %1", previousStatement: null, nextStatement: null, style: "sc_pen", args0: [NUM("S", 4)] },
    { type: "sc_stamp", message0: "盖图章", previousStatement: null, nextStatement: null, style: "sc_pen", tooltip: "把角色现在的样子印在画布上" },

    // ---- 控制 ----
    { type: "sc_wait", message0: "等待 %1 秒", previousStatement: null, nextStatement: null, style: "sc_control", args0: [NUM("SECS", 1)] },
    { type: "sc_repeat", message0: "重复 %1 次 %2", previousStatement: null, nextStatement: null, style: "sc_control", args0: [NUM("TIMES", 10), { type: "input_statement", name: "DO0" }], tooltip: "把积木放进里面，就会重复执行指定次数" },
    { type: "sc_forever", message0: "重复执行 %1", previousStatement: null, style: "sc_control", args0: [{ type: "input_statement", name: "DO0" }], tooltip: "里面的积木会一直重复，点红停停下来" },
    { type: "sc_if", message0: "如果 %1 那么 %2", previousStatement: null, nextStatement: null, style: "sc_control", args0: [{ type: "input_value", name: "IF0" }, { type: "input_statement", name: "DO0" }] },
    { type: "sc_if_else", message0: "如果 %1 那么 %2 否则 %3", previousStatement: null, nextStatement: null, style: "sc_control", args0: [{ type: "input_value", name: "IF0" }, { type: "input_statement", name: "DO0" }, { type: "input_statement", name: "ELSE" }] },
    { type: "sc_wait_until", message0: "等待 %1", previousStatement: null, nextStatement: null, style: "sc_control", args0: [{ type: "input_value", name: "IF0" }] },
    { type: "sc_stop_all", message0: "停止全部脚本", previousStatement: null, nextStatement: null, style: "sc_control", hat: "cap" },

    // ---- 侦测 ----
    { type: "sc_key_pressed", message0: "%1 键被按下？", output: "Boolean", style: "sc_sensing", args0: [{ type: "field_dropdown", name: "KEY", options: KEY_OPTIONS }] },
    { type: "sc_touching_edge", message0: "碰到边缘？", output: "Boolean", style: "sc_sensing" },
    { type: "sc_mouse_x", message0: "鼠标 x", output: "Number", style: "sc_sensing" },
    { type: "sc_mouse_y", message0: "鼠标 y", output: "Number", style: "sc_sensing" },
    { type: "sc_timer", message0: "计时器", output: "Number", style: "sc_sensing", tooltip: "从点绿旗开始过了几秒" },
    { type: "sc_reset_timer", message0: "计时器归零", previousStatement: null, nextStatement: null, style: "sc_sensing" },
  ];
}

export function SCRATCH_TOOLBOX() {
  return {
    kind: "categoryToolbox",
    contents: [
      { kind: "category", name: "🟡 事件", categorystyle: "sc_event", contents: [
        { kind: "block", type: "sc_when_flag" },
        { kind: "block", type: "sc_when_key" },
        { kind: "block", type: "sc_when_clicked" },
      ] },
      { kind: "category", name: "🔵 运动", categorystyle: "sc_motion", contents: [
        { kind: "block", type: "sc_move" },
        { kind: "block", type: "sc_turn_right" },
        { kind: "block", type: "sc_turn_left" },
        { kind: "block", type: "sc_goto", inputs: { X: { shadow: { type: "math_number", fields: { NUM: 0 } } }, Y: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "sc_glide", inputs: { SECS: { shadow: { type: "math_number", fields: { NUM: 1 } } }, X: { shadow: { type: "math_number", fields: { NUM: 100 } } }, Y: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "sc_point" },
        { kind: "block", type: "sc_bounce" },
        { kind: "block", type: "sc_change_x" },
        { kind: "block", type: "sc_change_y" },
      ] },
      { kind: "category", name: "🟣 外观", categorystyle: "sc_looks", contents: [
        { kind: "block", type: "sc_say" },
        { kind: "block", type: "sc_say_for", fields: { TEXT: "你好！", SECS: 2 } },
        { kind: "block", type: "sc_think_for" },
        { kind: "block", type: "sc_switch_costume" },
        { kind: "block", type: "sc_next_costume" },
        { kind: "block", type: "sc_change_size" },
        { kind: "block", type: "sc_set_size" },
        { kind: "block", type: "sc_show" },
        { kind: "block", type: "sc_hide" },
        { kind: "block", type: "sc_color_effect" },
        { kind: "block", type: "sc_clear_effects" },
      ] },
      { kind: "category", name: "🖊️ 画笔", categorystyle: "sc_pen", contents: [
        { kind: "block", type: "sc_pen_clear" },
        { kind: "block", type: "sc_pen_down" },
        { kind: "block", type: "sc_pen_up" },
        { kind: "block", type: "sc_pen_color" },
        { kind: "block", type: "sc_pen_size", inputs: { S: { shadow: { type: "math_number", fields: { NUM: 4 } } } } },
        { kind: "block", type: "sc_stamp" },
      ] },
      { kind: "category", name: "🟠 控制", categorystyle: "sc_control", contents: [
        { kind: "block", type: "sc_wait" },
        { kind: "block", type: "sc_repeat", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "sc_forever" },
        { kind: "block", type: "sc_if" },
        { kind: "block", type: "sc_if_else" },
        { kind: "block", type: "sc_wait_until" },
        { kind: "block", type: "sc_stop_all" },
      ] },
      { kind: "category", name: "🌊 侦测", categorystyle: "sc_sensing", contents: [
        { kind: "block", type: "sc_key_pressed" },
        { kind: "block", type: "sc_touching_edge" },
        { kind: "block", type: "sc_mouse_x" },
        { kind: "block", type: "sc_mouse_y" },
        { kind: "block", type: "sc_timer" },
        { kind: "block", type: "sc_reset_timer" },
      ] },
      { kind: "category", name: "🔢 运算", categorystyle: "sc_operators", contents: [
        { kind: "block", type: "math_random_int", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "math_arithmetic", inputs: { A: { shadow: { type: "math_number", fields: { NUM: 0 } } }, B: { shadow: { type: "math_number", fields: { NUM: 0 } } } } },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
        { kind: "block", type: "text_join", inputs: { ADD0: { shadow: { type: "text", fields: { TEXT: "苹果" } } }, ADD1: { shadow: { type: "text", fields: { TEXT: "香蕉" } } } } },
        { kind: "block", type: "text", fields: { TEXT: " " } },
      ] },
      { kind: "category", name: "🔴 变量", custom: "VARIABLE", categorystyle: "sc_data" },
    ],
  };
}

/* ================= 编译：序列化 JSON → 命令树 ================= */
/* Cmd 形如 {t:"move", v} / {t:"glide", secs, x, y} / {t:"repeat", times, body} ...
   Expr 形如 {k:"num", v} / {k:"var", name} / {k:"op", op, a, b} ...            */

function indexBlocks(root) {
  const byId = new Map();
  const tops = [];
  const walk = (block, isTop) => {
    if (!block || byId.has(block.id)) return;
    byId.set(block.id, block);
    if (isTop) tops.push(block);
    if (block.next?.block) walk(block.next.block, false);
    for (const input of Object.values(block.inputs || {})) {
      if (input.block) walk(input.block, false);
      if (input.shadow) walk(input.shadow, false);
    }
  };
  for (const block of root?.blocks?.blocks || []) walk(block, true);
  return { byId, tops };
}

/** 字段原始值：Blockly save 出来是扁平值（"画好啦"、2、"GT"），
 *  兼容手写 JSON 里出现过的 {value:x}/{text:x} 包装。 */
function rawField(block, name) {
  const raw = block?.fields?.[name];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "object") return raw.value ?? raw.text;
  return raw;
}

function fieldValue(block, name, fallback) {
  const raw = rawField(block, name);
  return raw === undefined ? fallback : raw;
}

function inputExpr(block, name, variables) {
  const input = block?.inputs?.[name];
  const source = input?.block || input?.shadow;
  return source ? compileExpr(source, variables) : null;
}

/** 参数取值：优先输入里挂的块/影子块；没有输入时读字段本身的值
 *  （数字字段直存 fields.X: 5，如 sc_goto 的 X/Y）。 */
function inputArg(block, name, variables, fallbackValue = null) {
  const fromInput = inputExpr(block, name, variables);
  if (fromInput) return fromInput;
  const raw = rawField(block, name);
  if (raw !== undefined && raw !== null && raw !== "") return { k: "num", v: Number(raw) };
  return fallbackValue == null ? null : { k: "num", v: fallbackValue };
}

/** 变量字段：field_variable 存 {VAR:{id}}，兜底扁平名字符串 */
function varFieldId(block) {
  const field = block?.fields?.VAR;
  if (field && typeof field === "object") return String(field.id ?? field.value ?? "");
  return String(field ?? "");
}

function varNameOf(block, variables) {
  const id = varFieldId(block);
  const found = (variables || []).find((item) => item.id === id || item.name === id);
  return found?.name || id || "变量";
}

function inputStatementBody(block, name, variables) {
  const inner = block?.inputs?.[name]?.block;
  return inner ? chain(inner, variables) : [];
}

function chain(start, variables) {
  const body = [];
  let cursor = start;
  while (cursor) {
    const cmd = compileCmd(cursor, variables);
    if (cmd) body.push(cmd);
    cursor = cursor.next?.block;
  }
  return body;
}

function compileExpr(block, variables) {
  const type = String(block.type || "");
  switch (type) {
    case "math_number":
    case "math_integer":
      return { k: "num", v: Number(fieldValue(block, "NUM", 0)) };
    case "text":
      return { k: "str", v: String(fieldValue(block, "TEXT", "")) };
    case "variables_get":
      return { k: "var", name: varNameOf(block, variables) };
    case "math_arithmetic":
      return { k: "op", op: fieldValue(block, "OP", "ADD"), a: inputExpr(block, "A", variables), b: inputExpr(block, "B", variables) };
    case "math_random_int":
      return { k: "rand", a: inputExpr(block, "FROM", variables), b: inputExpr(block, "TO", variables) };
    case "math_single":
      return { k: "op", op: fieldValue(block, "OP", "ADD"), a: { k: "num", v: 0 }, b: inputExpr(block, "NUM", variables) };
    case "logic_compare":
      return { k: "cmp", op: fieldValue(block, "OP", "EQ"), a: inputExpr(block, "A", variables), b: inputExpr(block, "B", variables) };
    case "logic_operation":
      return { k: "logic", op: fieldValue(block, "OP", "AND"), a: inputExpr(block, "A", variables), b: inputExpr(block, "B", variables) };
    case "logic_negate":
      return { k: "not", a: inputExpr(block, "BOOL", variables) };
    case "logic_boolean":
      return { k: "bool", v: fieldValue(block, "BOOL", "TRUE") === "TRUE" };
    case "text_join":
      return { k: "join", a: inputExpr(block, "ADD0", variables), b: inputExpr(block, "ADD1", variables) };
    case "sc_key_pressed":
      return { k: "key", key: fieldValue(block, "KEY", "space") };
    case "sc_touching_edge":
      return { k: "touchingEdge" };
    case "sc_mouse_x":
      return { k: "mouseX" };
    case "sc_mouse_y":
      return { k: "mouseY" };
    case "sc_timer":
      return { k: "timer" };
    default:
      return { k: "num", v: 0 };
  }
}

function compileCmd(block, variables) {
  const type = String(block.type || "");
  switch (type) {
    case "sc_move": return { t: "move", v: inputArg(block, "STEPS", variables, 10) };
    case "sc_turn_right": return { t: "turn", deg: inputArg(block, "DEG", variables, 15) };
    case "sc_turn_left": return { t: "turn", deg: inputArg(block, "DEG", variables, -15) };
    case "sc_goto": return { t: "goto", x: inputArg(block, "X", variables, 0), y: inputArg(block, "Y", variables, 0) };
    case "sc_glide": return { t: "glide", secs: inputArg(block, "SECS", variables, 1), x: inputArg(block, "X", variables, 100), y: inputArg(block, "Y", variables, 0) };
    case "sc_point": return { t: "point", deg: inputArg(block, "DEG", variables, 90) };
    case "sc_bounce": return { t: "bounce" };
    case "sc_change_x": return { t: "changeXY", dx: inputArg(block, "DX", variables, 10), dy: { k: "num", v: 0 } };
    case "sc_change_y": return { t: "changeXY", dx: { k: "num", v: 0 }, dy: inputArg(block, "DY", variables, 10) };
    case "sc_say": return { t: "say", text: { k: "str", v: String(fieldValue(block, "TEXT", "")) }, secs: null, think: false };
    case "sc_say_for": return { t: "say", text: { k: "str", v: String(fieldValue(block, "TEXT", "")) }, secs: inputArg(block, "SECS", variables, 2), think: false };
    case "sc_think_for": return { t: "say", text: { k: "str", v: String(fieldValue(block, "TEXT", "")) }, secs: inputArg(block, "SECS", variables, 2), think: true };
    case "sc_switch_costume": return { t: "costume", v: fieldValue(block, "COSTUME", "🐱") };
    case "sc_next_costume": return { t: "nextCostume" };
    case "sc_change_size": return { t: "changeSize", v: inputArg(block, "DS", variables, 10) };
    case "sc_set_size": return { t: "setSize", v: inputArg(block, "S", variables, 100) };
    case "sc_show": return { t: "show" };
    case "sc_hide": return { t: "hide" };
    case "sc_color_effect": return { t: "colorEffect", v: inputArg(block, "D", variables, 25) };
    case "sc_clear_effects": return { t: "clearEffects" };
    case "sc_pen_clear": return { t: "penClear" };
    case "sc_pen_down": return { t: "penDown" };
    case "sc_pen_up": return { t: "penUp" };
    case "sc_pen_color": return { t: "penColor", v: fieldValue(block, "COLOR", "#4c97ff") };
    case "sc_pen_size": return { t: "penSize", v: inputArg(block, "S", variables, 4) };
    case "sc_stamp": return { t: "stamp" };
    case "sc_wait": return { t: "wait", secs: inputArg(block, "SECS", variables, 1) };
    case "sc_repeat": return { t: "repeat", times: inputArg(block, "TIMES", variables, 10), body: inputStatementBody(block, "DO0", variables) };
    case "sc_forever": return { t: "forever", body: inputStatementBody(block, "DO0", variables) };
    case "sc_if": return { t: "if", cond: inputExpr(block, "IF0", variables), then: inputStatementBody(block, "DO0", variables), otherwise: [] };
    case "sc_if_else": return { t: "if", cond: inputExpr(block, "IF0", variables), then: inputStatementBody(block, "DO0", variables), otherwise: inputStatementBody(block, "ELSE", variables) };
    case "sc_wait_until": return { t: "waitUntil", cond: inputExpr(block, "IF0", variables) };
    case "sc_stop_all": return { t: "stopAll" };
    case "sc_reset_timer": return { t: "resetTimer" };
    case "variables_set":
      return { t: "setVar", name: varNameOf(block, variables), v: inputArg(block, "VALUE", variables, 0) };
    case "math_change":
      return { t: "changeVar", name: varNameOf(block, variables), v: inputArg(block, "DELTA", variables, 1) };
    default:
      return null;
  }
}

const HAT_TYPES = { sc_when_flag: "flag", sc_when_key: "key", sc_when_clicked: "clicked" };

/** 把一个角色的脚本 JSON 编译成触发器脚本列表 */
export function compileSpriteScripts(scriptJson) {
  if (!scriptJson) return [];
  const { tops } = indexBlocks(scriptJson);
  const variables = scriptJson.variables || [];
  const scripts = [];
  for (const top of tops) {
    const hat = HAT_TYPES[top.type];
    if (!hat) continue;
    const first = top.next?.block;
    scripts.push({
      hat,
      key: hat === "key" ? fieldValue(top, "KEY", "space") : null,
      body: first ? chain(first, variables) : [],
      topId: top.id,
    });
  }
  return scripts;
}
