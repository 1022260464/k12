import Editor, { loader } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
// monaco-editor@0.56 exports 映射到 esm/vs/*，不要写完整 esm 路径
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import { lintPythonSource } from "../utils/pythonDiagnostics.js";

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco });

const PYTHON_KEYWORDS = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
  "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

const PYTHON_BUILTINS = [
  "abs", "all", "any", "bin", "bool", "bytearray", "bytes", "callable", "chr",
  "dict", "dir", "divmod", "enumerate", "filter", "float", "format", "frozenset",
  "getattr", "hasattr", "hash", "help", "hex", "id", "input", "int", "isinstance",
  "issubclass", "iter", "len", "list", "map", "max", "min", "next", "object",
  "oct", "open", "ord", "pow", "print", "range", "repr", "reversed", "round",
  "set", "setattr", "slice", "sorted", "str", "sum", "super", "tuple", "type",
  "vars", "zip",
];

let providersRegistered = false;

function ensurePythonAssist() {
  if (providersRegistered) return;
  providersRegistered = true;

  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: [".", "_"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const keywordItems = PYTHON_KEYWORDS.map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: label,
        range,
      }));
      const builtinItems = PYTHON_BUILTINS.map((label) => ({
        label,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: label,
        detail: "内置函数",
        range,
      }));
      const snippetItems = [
        {
          label: "for",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "for ${1:item} in ${2:items}:\n\t${3:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "for 循环",
          range,
        },
        {
          label: "def",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "def ${1:name}(${2}):\n\t${3:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "定义函数",
          range,
        },
        {
          label: "if",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "if ${1:condition}:\n\t${2:pass}",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "条件判断",
          range,
        },
        {
          label: "print",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "print(${1})",
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: "打印输出",
          range,
        },
      ];
      return { suggestions: [...snippetItems, ...keywordItems, ...builtinItems] };
    },
  });
}

function toMonacoMarkers(diagnostics, monacoApi) {
  return (diagnostics || []).map((item) => ({
    startLineNumber: item.line,
    startColumn: 1,
    endLineNumber: item.line,
    endColumn: 200,
    message: item.message,
    severity: item.severity === "warning"
      ? monacoApi.MarkerSeverity.Warning
      : monacoApi.MarkerSeverity.Error,
  }));
}

export function PythonCodeEditor({
  value,
  onChange,
  diagnostics = [],
  readOnly = false,
  maxLength = 100000,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const lintTimer = useRef(null);

  function applyMarkers(extra = []) {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;
    const model = editor.getModel();
    if (!model) return;
    const staticLint = lintPythonSource(model.getValue());
    const merged = [...staticLint, ...extra, ...diagnostics];
    monacoApi.editor.setModelMarkers(model, "k12-python", toMonacoMarkers(merged, monacoApi));
  }

  useEffect(() => {
    applyMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostics, value]);

  useEffect(() => () => {
    if (lintTimer.current) window.clearTimeout(lintTimer.current);
  }, []);

  return (
    <div className="python-monaco-host">
      <Editor
        language="python"
        theme="vs"
        value={value}
        path="main.py"
        loading={<div className="python-monaco-loading">正在加载编辑器…</div>}
        options={{
          readOnly,
          fontSize: 14,
          fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
          lineHeight: 22,
          // 绝对行号：左侧从 1 起逐行递增（不要 relative / interval）
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          renderLineHighlightOnlyWhenFocus: false,
          glyphMargin: false,
          folding: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: "off",
          renderLineHighlight: "line",
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          snippetSuggestions: "inline",
          padding: { top: 8, bottom: 8 },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        }}
        onMount={(editor, monacoApi) => {
          editorRef.current = editor;
          monacoRef.current = monacoApi;
          editor.updateOptions({ lineNumbers: "on" });
          ensurePythonAssist();
          applyMarkers();
          editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.Enter, () => {
            const form = editor.getContainerDomNode()?.closest("form");
            form?.requestSubmit?.();
          });
        }}
        onChange={(next) => {
          const text = next ?? "";
          if (text.length > maxLength) {
            onChange?.(text.slice(0, maxLength));
            return;
          }
          onChange?.(text);
          if (lintTimer.current) window.clearTimeout(lintTimer.current);
          lintTimer.current = window.setTimeout(() => applyMarkers(), 280);
        }}
      />
    </div>
  );
}

export default PythonCodeEditor;
