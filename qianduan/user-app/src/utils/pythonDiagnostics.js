/** 从 Python traceback / 常见语法提示中提取行号与消息 */
export function parsePythonDiagnostics(stderr) {
  if (!stderr || typeof stderr !== "string") return [];
  const diagnostics = [];
  const lineHit = /(?:File "[^"]+", line |line )(\d+)/gi;
  let match;
  const lines = new Set();
  while ((match = lineHit.exec(stderr))) {
    const line = Number(match[1]);
    if (Number.isInteger(line) && line > 0) lines.add(line);
  }
  const message = stderr
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" · ")
    .slice(0, 240)
    || "代码运行出错";

  lines.forEach((line) => {
    diagnostics.push({
      line,
      message,
      severity: "error",
    });
  });

  if (!diagnostics.length) {
    const syntax = stderr.match(/SyntaxError|IndentationError|NameError|TypeError|ValueError|ZeroDivisionError/);
    if (syntax) {
      diagnostics.push({ line: 1, message, severity: "error" });
    }
  }
  return diagnostics;
}

/**
 * 轻量静态检查：括号/引号配对、Tab 混用提示（非完整类型检查）。
 */
export function lintPythonSource(source) {
  const diagnostics = [];
  if (!source) return diagnostics;
  const rows = source.split(/\r?\n/);
  const stack = [];
  const pairs = { ")": "(", "]": "[", "}": "{" };
  let inSingle = false;
  let inDouble = false;
  let inTripleSingle = false;
  let inTripleDouble = false;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.includes("\t") && row.includes("    ")) {
      diagnostics.push({
        line: i + 1,
        message: "同一行同时出现 Tab 与空格缩进，容易导致 IndentationError",
        severity: "warning",
      });
    }
    for (let j = 0; j < row.length; j += 1) {
      const ch = row[j];
      const next2 = row.slice(j, j + 3);
      if (!inSingle && !inDouble && next2 === "'''") {
        inTripleSingle = !inTripleSingle;
        j += 2;
        continue;
      }
      if (!inSingle && !inDouble && next2 === '"""') {
        inTripleDouble = !inTripleDouble;
        j += 2;
        continue;
      }
      if (inTripleSingle || inTripleDouble) continue;
      if (ch === "\\" && (inSingle || inDouble)) {
        j += 1;
        continue;
      }
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (inSingle || inDouble) continue;
      if (ch === "(" || ch === "[" || ch === "{") stack.push({ ch, line: i + 1 });
      else if (ch === ")" || ch === "]" || ch === "}") {
        const top = stack.pop();
        if (!top || top.ch !== pairs[ch]) {
          diagnostics.push({
            line: i + 1,
            message: `括号不匹配：意外的 “${ch}”`,
            severity: "error",
          });
        }
      }
    }
  }
  if (inSingle || inDouble || inTripleSingle || inTripleDouble) {
    diagnostics.push({
      line: rows.length,
      message: "字符串引号未闭合",
      severity: "error",
    });
  }
  stack.slice(-5).forEach((item) => {
    diagnostics.push({
      line: item.line,
      message: `括号未闭合：“${item.ch}”`,
      severity: "error",
    });
  });
  return diagnostics.slice(0, 20);
}
