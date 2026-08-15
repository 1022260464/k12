# K12 Code Reviewer 开发路线

## 总体目标

构建一个可被AI Agent稳定调用的多语言静态分析工具。Rust引擎输出确定性诊断，AI Agent
负责教学解释、修改建议和追问。代码编译与运行始终由独立沙箱承担。

## 阶段0：工程骨架

当前已完成：

- Rust Workspace与固定工具链。
- `reviewer-core`和`reviewer-cli`职责拆分。
- camelCase JSON请求和响应契约。
- 规则扩展接口与基线规则。
- 示例请求、单元测试、Clippy和格式化配置。

## 阶段1：Python静态审查

目标：完成比赛项目第一种语言的确定性审查闭环。

- 接入Tree-sitter Python语法树。
- 实现函数长度、嵌套深度、危险调用和空异常处理规则。
- 接入Ruff JSON结果。
- 接入Bandit安全诊断。
- 固定工具配置，不读取学生项目中的可执行插件配置。
- Python Agent Runtime增加 `review_code` 工具适配器。
- Java增加代码审查任务记录和查询接口。

## 阶段2：JavaScript与TypeScript

- 接入Tree-sitter JavaScript和TypeScript语法树。
- JavaScript接入ESLint固定规则集。
- TypeScript接入 `tsc --noEmit` 类型诊断。
- 统一ESLint和TypeScript行列位置、错误码及严重级别。
- 禁止加载用户提交的ESLint插件和配置文件。

## 阶段3：Java

- 接入Tree-sitter Java语法树。
- 接入Checkstyle教学规范。
- 接入SpotBugs或等价字节码检查。
- 需要 `javac` 或字节码时通过沙箱执行，不在Reviewer进程运行不可信构建。

## 阶段4：Agent与RabbitMQ闭环

- 定义 `review_code(language, sourceCode, ruleset)` Agent工具。
- Java创建 `reviewId` 并写入任务表。
- RabbitMQ发布审查任务。
- Python Worker调用Rust CLI。
- Rust诊断交给Agent生成中文教学解释。
- Java保存结构化诊断和AI解释。
- 前端按文件、行号和严重级别展示问题。

## 阶段5：编译、测试与代码沙箱

- 独立Sandbox Worker，不与FastAPI和Reviewer共进程。
- Python、Java、Rust和Node使用不同预构建镜像。
- 默认禁网、非root、只读根文件系统、临时工作目录。
- 设置CPU、内存、进程数、文件大小、输出大小和超时限制。
- 图表、CSV、图片等产物上传MinIO，消息只返回产物元数据和URI。

## 规则开发规范

每条规则必须包含：

```text
稳定ruleId
适用语言
严重级别
精确行列位置
可理解的问题描述
可操作的修改建议
正例和反例测试
已知误报说明
```

跨语言规则放在 `reviewer-core`。依赖具体语法树、编译器或Lint工具的实现应拆成独立
language adapter crate，不能让核心领域模型依赖某个语言工具。

## 非目标

- 不自行重写Python、Java或TypeScript完整类型系统。
- 不让大模型替代确定性的编译器和Lint诊断。
- 不在Rust Reviewer进程执行学生代码。
- 不允许用户任意安装分析插件或依赖。
- 不把Reviewer直接暴露为公网服务。
