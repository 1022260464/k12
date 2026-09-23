const MAX_REPEAT_TIMES = 10;
const MAX_COMMANDS = 80;

export function compileBlocklyWorkspace(workspace) {
  const startBlocks = workspace.getTopBlocks(true).filter((block) => block.type === "k12_when_start");
  if (!startBlocks.length) {
    throw new Error("请先放入“开始任务”积木");
  }
  if (startBlocks.length > 1) {
    throw new Error("一个任务只能有一个“开始任务”积木");
  }

  const commands = compileChain(startBlocks[0].getNextBlock());
  if (!commands.length) {
    throw new Error("请把任务积木连接到“开始任务”下面");
  }
  if (countCommands(commands) > MAX_COMMANDS) {
    throw new Error("积木数量太多，请把任务缩短后再运行");
  }
  return commands;
}

function compileChain(firstBlock) {
  const commands = [];
  let current = firstBlock;
  while (current) {
    commands.push(compileBlock(current));
    current = current.getNextBlock();
  }
  return commands;
}

function compileBlock(block) {
  switch (block.type) {
    case "k12_label_image":
      return {
        type: "LABEL",
        imageId: block.getFieldValue("IMAGE"),
        category: block.getFieldValue("CATEGORY"),
      };
    case "k12_train_classifier":
      return { type: "TRAIN" };
    case "k12_predict_image":
      return { type: "PREDICT", imageId: block.getFieldValue("IMAGE") };
    case "k12_move":
      return { type: "MOVE", steps: clampNumber(block.getFieldValue("STEPS"), 1, 10, 1) };
    case "k12_say":
      return { type: "SAY", message: String(block.getFieldValue("MESSAGE") || "").slice(0, 40) };
    case "k12_check_balance":
      return { type: "BALANCE_CHECK" };
    case "k12_quiz_answer":
      return {
        type: "QUIZ_ANSWER",
        questionId: block.getFieldValue("QUESTION"),
        answer: block.getFieldValue("ANSWER"),
      };
    case "k12_submit_quiz":
      return { type: "QUIZ_SUBMIT" };
    case "k12_switch_scene":
      return { type: "SCENE", sceneId: block.getFieldValue("SCENE") };
    case "k12_wait":
      return { type: "WAIT", seconds: clampNumber(block.getFieldValue("SECONDS"), 1, 10, 1) };
    case "controls_repeat_ext": {
      const timesBlock = block.getInputTargetBlock("TIMES");
      const times = clampNumber(timesBlock?.getFieldValue("NUM"), 1, MAX_REPEAT_TIMES, 2);
      return { type: "REPEAT", times, commands: compileChain(block.getInputTargetBlock("DO")) };
    }
    case "controls_if": {
      const condition = block.getInputTargetBlock("IF0");
      const compiledCondition = compileCondition(condition);
      return {
        type: compiledCondition.type,
        expected: compiledCondition.expected,
        threshold: compiledCondition.threshold,
        commands: compileChain(block.getInputTargetBlock("DO0")),
      };
    }
    default:
      throw new Error(`暂不支持积木：${block.type}`);
  }
}

function compileCondition(condition) {
  if (!condition) {
    throw new Error("“如果”积木需要连接一个判断积木");
  }
  if (condition.type === "k12_prediction_equals") {
    return { type: "IF_PREDICTION", expected: condition.getFieldValue("CATEGORY") };
  }
  if (condition.type === "k12_confidence_at_least") {
    return {
      type: "IF_CONFIDENCE",
      threshold: clampNumber(condition.getFieldValue("THRESHOLD"), 50, 100, 80),
    };
  }
  throw new Error("“如果”积木需要连接预测结果或置信度判断积木");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function countCommands(commands) {
  return commands.reduce((total, command) => (
    total + 1 + (Array.isArray(command.commands) ? countCommands(command.commands) : 0)
  ), 0);
}
