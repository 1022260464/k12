# K12 Code Reviewer

`k12-code-reviewer` 是使用Rust实现的多语言静态代码审查工具。它为AI Agent提供确定性的
代码诊断结果，由Agent负责把错误解释成适合学生理解的反馈。

当前工具只分析源码文本，不编译、不安装依赖、不执行用户代码。

## 定位

```text
代码审查Agent
    -> review_code工具
    -> Rust Reviewer CLI
    -> 统一JSON诊断
    -> Agent生成中文解释和修改建议
```

Rust Reviewer负责：

- 统一不同语言的请求和诊断模型。
- 执行跨语言AST与安全规则。
- 后续适配Ruff、Bandit、ESLint、TypeScript、Checkstyle等成熟工具。
- 输出稳定JSON，屏蔽各语言工具的格式差异。

Rust Reviewer不负责：

- 直接运行学生或AI生成的代码。
- 在宿主机安装用户指定依赖。
- 代替完整编译器、类型系统或语言服务器。
- 直接生成教学解释，教学解释由AI Agent完成。

## 工程结构

```text
tools/k12-code-reviewer/
├── crates/
│   ├── reviewer-core/      # 领域模型、规则接口、静态审查引擎
│   └── reviewer-cli/       # stdin/文件JSON命令行入口
├── examples/               # Agent调用契约示例
├── docs/                   # 开发目标与扩展说明
├── Cargo.toml              # Rust Workspace
└── rust-toolchain.toml     # 固定Rust工具链
```

## 当前能力

第一版包含三个基线规则：

```text
common.source.empty
common.source.too-large
security.dynamic-code-execution
security.possible-hardcoded-secret
```

这些规则用于验证架构和契约，不代表完整的生产级代码审查能力。当前危险API和硬编码凭据
检测仍是保守的文本规则，后续会由Tree-sitter AST规则与语言专用工具替换或补充。

## 运行

```powershell
Set-Location D:\CodeWorkPlace\k12\tools\k12-code-reviewer
cargo run -p k12-code-reviewer-cli -- review `
  --input examples\python-review-request.json `
  --pretty
```

也可以从标准输入读取，便于Python Worker调用：

```powershell
Get-Content examples\python-review-request.json -Raw |
  cargo run -q -p k12-code-reviewer-cli -- review --pretty
```

构建发布版二进制：

```powershell
cargo build --release -p k12-code-reviewer-cli
```

输出文件：

```text
target/release/k12-code-reviewer.exe
```

## 输入契约

```json
{
  "requestId": "review-demo-001",
  "language": "python",
  "fileName": "student_answer.py",
  "ruleset": "k12-default",
  "sourceCode": "print('hello')"
}
```

支持的语言标识已经预留：

```text
python
java
javascript
typescript
rust
```

标识存在不代表对应语言的语义检查器已经完成。

## 输出契约

```json
{
  "requestId": "review-demo-001",
  "language": "python",
  "status": "COMPLETED",
  "ruleset": "k12-default",
  "diagnostics": [
    {
      "ruleId": "security.dynamic-code-execution",
      "severity": "ERROR",
      "message": "Avoid dynamic code execution through `eval(`.",
      "location": {"line": 2, "column": 10},
      "suggestion": "Use an explicit parser, allow-list, or dedicated sandbox instead.",
      "analyzer": "k12-baseline"
    }
  ],
  "summary": {"errorCount": 1, "warningCount": 0, "infoCount": 0},
  "engineVersion": "0.1.0"
}
```

## Agent集成边界

Python侧后续在以下位置实现CLI适配器：

```text
ai-services/k12-agent-runtime/
└── infrastructure/tools/code_review/rust_cli.py
```

适配器只能：启动固定二进制、通过stdin传JSON、设置超时、限制输入输出并解析JSON。不能
使用 `shell=True`，也不能把用户输入拼接进Shell命令。

## 与代码沙箱的关系

当前基线规则只读取字符串，可以作为受限子进程运行。以下能力必须转到独立沙箱Worker：

```text
执行Python/Java/Rust/JS代码
运行cargo、javac、测试或构建脚本
加载用户项目中的插件、过程宏或注解处理器
安装用户指定依赖
```

详细开发计划见 [`docs/development-roadmap.md`](docs/development-roadmap.md)。

## 质量检查

```powershell
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```
