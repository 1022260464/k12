# K12 Agent Runtime 架构说明

## 1. 服务职责

Python Runtime只负责AI执行能力，不承担用户权限、业务数据CRUD或对外网关职责。

```text
React -> Gateway -> Java k12-agent-service -> FastAPI / RabbitMQ -> Agent Runtime
```

Java服务验证JWT、检查权限、创建任务记录并保存最终状态。Python服务运行Agent、RAG、工具
和模型调用，并返回标准化文本与产物。

## 2. Agent扩展方式

一个Agent适配器实现 `domain.agents.ports.AgentExecutor`：

```python
class TutorAgent:
    @property
    def code(self) -> str:
        return "tutor"

    async def invoke(self, run_input: AgentRunInput) -> AgentRunResult:
        ...
```

然后在 `bootstrap/container.py` 注册。未来接入LangGraph或其他SDK时，仅在
`infrastructure/agents/` 新增适配器，不把框架对象传进Controller和领域模型。

## 3. 同步与异步边界

短任务通过Java OpenFeign调用FastAPI。文档解析、批量批改、长时间Agent任务和代码执行
通过RabbitMQ投递。两种入口最终都调用 `RunAgentUseCase`，防止出现两套业务逻辑。

RabbitMQ任务和结果使用camelCase JSON，便于Java DTO直接反序列化。消息必须包含
`runId`，由Java数据库记录负责幂等和状态查询。

## 4. 前端产物协议

产物类型包括：

```text
CHART  Vega-Lite或ECharts JSON
IMAGE  PNG/JPEG/WebP地址
TABLE  小型结构化表格
TEXT   Markdown或纯文本
FILE   CSV/PDF/Notebook等下载地址
```

小型图表配置可以放在 `payload`，大文件必须上传MinIO后返回 `uri`。前端根据 `kind` 和
`mimeType` 选择安全的渲染组件，不直接执行模型返回的HTML或JavaScript。

## 5. 代码沙箱目标架构

```text
Frontend
  -> Java创建executionId
  -> RabbitMQ代码任务队列
  -> Python Agent Worker
  -> CodeSandbox领域端口
  -> TencentAgentSandboxAdapter
  -> 腾讯云Agent Sandbox临时实例
  -> 生成PNG/JSON/CSV
  -> MinIO
  -> RabbitMQ结果消息
  -> Java更新任务状态
  -> Frontend展示artifact
```

正式执行平台只采用腾讯云Agent Sandbox（AGSX），不并行接入多家云厂商。每次任务使用
短生命周期沙箱实例，默认禁网，并设置CPU、内存、进程数、文件大小、输出大小和执行时间
限制。依赖通过团队维护的固定Python镜像提供，不允许用户任意访问PyPI。API和Worker主
进程只负责校验、调度和结果处理，永远不直接执行用户代码。

本地Piston只用于开发验证和断网演示。本地Rust Code Reviewer负责静态代码审查，不属于
云沙箱，也不执行用户代码。完整方案与备选平台资源见
[`code-sandbox-platform-guide.md`](code-sandbox-platform-guide.md)。

## 6. 后续基础设施适配器

```text
infrastructure/models/       大模型供应商适配器
infrastructure/rag/          pgvector检索和重排
infrastructure/tools/        课程、题库、搜索等工具
infrastructure/storage/      MinIO产物存储
infrastructure/persistence/  仅AI运行所需的存储适配器
infrastructure/sandbox/      腾讯云AGSX适配器
```

这些目录在真正出现实现时再创建，避免空目录和无效抽象。
