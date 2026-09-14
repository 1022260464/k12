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

千问配置只写入本地 `.env`，不要提交真实密钥：

```dotenv
K12_AGENT_LLM_PROVIDER=dashscope
K12_AGENT_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
K12_AGENT_LLM_API_KEY=
K12_AGENT_LLM_MODEL=qwen-plus
```

教学 Agent 通过领域层 `ChatModel` 接口调用模型，基础设施层负责适配千问的 OpenAI 兼容
接口。模型只生成受结构约束的教学文本，动画步骤仍由本地代码生成。模型未配置、超时、
网络失败或输出格式错误时自动回退到确定性讲解，因此本地演示不会被外部模型故障阻断。

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
GET  /internal/v1/rag/capabilities
POST /internal/v1/rag/embeddings
POST /internal/v1/rag/rerank
```

## 本地BGE检索模型

项目使用两个职责不同的模型：

```text
BAAI/bge-m3                 文本 -> 1024维稠密向量，用于pgvector召回
BAAI/bge-reranker-v2-m3     查询+候选片段 -> 相关性分数，用于Top-K精排
```

Windows和Linux上的PyTorch固定从官方CUDA 12.8索引安装。模型采用延迟加载：FastAPI启动
时不下载模型，也不占用显存；第一次调用对应接口时才从Hugging Face下载并加载。8GB显存的
本地配置：

```dotenv
K12_AGENT_RAG_ENABLED=true
K12_AGENT_EMBEDDING_DEVICE=cuda
K12_AGENT_EMBEDDING_USE_FP16=true
K12_AGENT_EMBEDDING_BATCH_SIZE=8
K12_AGENT_RERANKER_DEVICE=cuda
K12_AGENT_RERANKER_USE_FP16=true
K12_AGENT_RERANKER_BATCH_SIZE=4
```

验证CUDA：

```powershell
uv run python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

Embedding和Reranker只是RAG模型层。下一阶段还需要实现文档切分、pgvector写入、带学段和
教材条件的召回、引用组装以及检索评测，不能直接把完整文档全部发送给生成模型。

## 示例Agent

`study-plan` 是一个可直接调用的LangGraph学习计划示例，代码位于：

```text
src/k12_agent_runtime/infrastructure/agents/study_plan/
├── state.py   # 定义LangGraph共享状态
├── nodes.py   # 节点、条件路由和确定性示例逻辑
├── graph.py   # 添加节点、连接边并编译图
└── agent.py   # 适配K12 AgentExecutor和统一返回结果
```

执行图：

```mermaid
flowchart LR
    START --> NORMALIZE["normalize_input"]
    NORMALIZE -->|存在薄弱点| TARGETED["build_targeted_plan"]
    NORMALIZE -->|没有薄弱点| GENERAL["build_general_plan"]
    TARGETED --> RESPONSE["compose_response"]
    GENERAL --> RESPONSE
    RESPONSE --> END
```

该示例演示Agent输入、共享State、普通节点、条件边、图编译、异步执行、表格产物和元数据，
当前不依赖外部大模型。后续接入模型时，优先替换计划生成节点，不修改Controller和领域
协议。

`study-plan` 只用于展示 LangGraph 基础结构。赛题主流程使用 `teaching-assistant`，当前第一版
支持按学段讲解冒泡排序，并返回安全的动画步骤 JSON。

请求示例：

```http
POST /internal/v1/agents/teaching-assistant/invoke
Content-Type: application/json

{
  "inputText": "为什么冒泡排序要比较旁边的数字？",
  "context": {
    "stage": "小学高年级",
    "grade": "六年级",
    "textbook": "AI 通识课程示例教材",
    "chapter": "算法如何整理信息",
    "topic": "冒泡排序",
    "knownWeakPoints": ["相邻比较"]
  }
}
```

新增Agent时，实现 `AgentExecutor` 协议并在 `bootstrap/container.py` 的注册器中登记即可。

LangGraph复习顺序：

```text
State -> Node -> Edge -> Conditional Edge -> compile -> ainvoke
```

- `State`：节点共享的数据结构，示例使用 `TypedDict`。
- `Node`：读取State并返回部分State更新的Python函数。
- `Edge`：定义节点执行顺序。
- `Conditional Edge`：根据State动态选择下一节点。
- `compile()`：把构建器编译成可执行图。
- `ainvoke()`：异步执行图，适合FastAPI和异步Worker。

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

请求队列和结果队列都绑定同一个死信交换机。Java 与 Python 对同名队列的 durable、
dead-letter-exchange 等声明必须完全一致，否则 RabbitMQ 会拒绝启动并报告
`PRECONDITION_FAILED inequivalent arg`。

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

当前沙箱接口已预留，但默认返回503，且不会执行用户代码。正式实现采用腾讯云Agent
Sandbox（AGSX），由基础设施适配器创建短生命周期实例，并至少满足：默认禁网、临时工作
目录、CPU和内存限制、执行超时、固定依赖镜像以及输出大小限制。禁止在FastAPI或
RabbitMQ Worker主进程中调用 `exec`、`eval` 或 `subprocess` 直接执行前端代码。

详细设计见 [`docs/architecture.md`](docs/architecture.md)。

分批开发范围、每批验收标准以及你可以参与填写的教学样例见
[`docs/agent-collaboration-roadmap.md`](docs/agent-collaboration-roadmap.md)。新增 Agent 前先按该文档
完成“产品样例 -> State -> Node -> Graph -> Adapter -> 注册 -> 测试”的顺序。

腾讯云AGSX现行架构、Piston本地边界、Rust静态审查边界以及E2B等备选资源见
[`docs/code-sandbox-platform-guide.md`](docs/code-sandbox-platform-guide.md)。

## 质量检查

```powershell
uv run ruff check .
uv run pytest
```
