# K12 Agent Runtime

`k12-agent-runtime` 是平台内部的 Python AI 执行服务。它负责智能体编排、模型调用、
RAG、工具调用、异步任务消费，以及未来隔离代码沙箱产生的图表和文件。

## 分层结构

```text
src/k12_agent_runtime/
├── core/                   # 环境配置、日志等横切能力
├── bootstrap/              # 依赖装配，不放业务逻辑
├── domain/                 # Agent、产物、沙箱领域模型和端口
├── application/            # 运行Agent、执行代码等用例
├── infrastructure/         # Agent框架、RabbitMQ、存储、沙箱适配器
├── interfaces/api/         # FastAPI路由和HTTP Schema
├── workers/                # RabbitMQ等独立进程入口
└── main.py                 # FastAPI进程入口
```

依赖方向必须保持：

```text
interfaces/infrastructure -> application -> domain
```

`domain` 不允许导入 FastAPI、RabbitMQ、数据库SDK或具体Agent框架。

## 初始化

```powershell
Set-Location D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
Copy-Item .env.example .env
uv sync --dev
```

本地 `.env` 不提交Git。配置项统一使用 `K12_AGENT_` 前缀。

## 启动FastAPI

```powershell
uv run k12-agent-runtime
```

需要开发热重载时使用：

```powershell
uv run fastapi dev --host 127.0.0.1 --port 8090
```

默认地址：

- 服务：<http://127.0.0.1:8090>
- Swagger：<http://127.0.0.1:8090/docs>
- 健康检查：<http://127.0.0.1:8090/internal/v1/health>

当前提供的内部接口：

```text
GET  /internal/v1/health
GET  /internal/v1/agents
POST /internal/v1/agents/{agentCode}/invoke
GET  /internal/v1/sandbox/capabilities
POST /internal/v1/sandbox/executions
```

`.env` 配置了 `K12_AGENT_INTERNAL_API_KEY` 后，除健康检查外的内部接口必须携带：

```text
X-Internal-Api-Key: <configured-key>
```

## RabbitMQ Worker

先按照 `deploy/rabbitmq/README.md` 启动本地RabbitMQ，然后在本模块 `.env` 中配置：

```dotenv
K12_AGENT_RABBITMQ_ENABLED=true
K12_AGENT_RABBITMQ_URL=amqp://k12:<password>@127.0.0.1:5672/k12
```

启动独立消费者：

```powershell
uv run k12-agent-worker
```

消息拓扑：

```text
Exchange: k12.agent
Request queue: k12.agent.run.request
Result queue: k12.agent.run.result
Dead-letter exchange: k12.agent.dlx
Dead-letter queue: k12.agent.run.dead
```

## 图表与文件产物

Agent输出使用统一 `artifacts` 数组。当前 `demo-chart` 返回 Vega-Lite JSON：

```json
{
  "kind": "CHART",
  "mimeType": "application/vnd.vegalite.v5+json",
  "payload": {}
}
```

后续图片、CSV、Notebook等大文件上传MinIO，只在 `uri` 中返回对象地址，不能把大文件
Base64直接塞进RabbitMQ消息或普通API响应。

## 代码沙箱安全边界

当前沙箱接口已预留，但默认返回503，且不会执行用户代码。正式实现必须由独立Worker在
短生命周期隔离容器中执行，并至少满足：禁用网络、只读根文件系统、临时工作目录、CPU和
内存限制、执行超时、包白名单、输出大小限制、非root用户运行。禁止在FastAPI或RabbitMQ
Worker主进程中调用 `exec`、`eval` 或 `subprocess` 直接执行前端代码。

详细设计见 [`docs/architecture.md`](docs/architecture.md)。

## 质量检查

```powershell
uv run ruff check .
uv run pytest
```
