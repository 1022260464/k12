# Agent Java 接口与 Python Runtime 联调说明

## 1. 两个服务分别负责什么

```text
React / Apifox
      |
      | Bearer JWT
      v
Gateway :8080
      |
      v
Java k12-agent-service :8083
      | 1. 校验 JWT 和 agent:invoke
      | 2. 从 JWT 读取 userId
      | 3. 检查 agent_config 是否存在并启用
      | 4. 调用 Python 内部接口
      | 5. 保存 agent_run 和 agent_artifact
      v
FastAPI k12-agent-runtime :8090
      |
      v
LangGraph Agent / 工具 / 沙箱
```

Java 是面向前端的业务入口，负责认证、权限、数据范围和 MySQL 记录。Python 是内部执行
引擎，负责 LangGraph、模型调用和工具执行。前端不能直接调用 Python Runtime，否则会绕过
JWT、权限和运行审计。

## 2. 配置

Java `k12-agent-service`：

```powershell
$env:K12_AGENT_RUNTIME_URL = "http://127.0.0.1:8090"
$env:K12_AGENT_INTERNAL_API_KEY = "本地联调密钥"

# 需要测试长任务时再启用 RabbitMQ
$env:K12_AGENT_RABBITMQ_ENABLED = "true"
$env:K12_RABBITMQ_HOST = "127.0.0.1"
$env:K12_RABBITMQ_USERNAME = "k12"
$env:K12_RABBITMQ_PASSWORD = "本地 .env 中的密码"
$env:K12_RABBITMQ_VHOST = "k12"
```

Python Runtime 的 `.env` 使用相同密钥：

```dotenv
K12_AGENT_INTERNAL_API_KEY=本地联调密钥
K12_AGENT_RABBITMQ_ENABLED=true
K12_AGENT_RABBITMQ_URL=amqp://k12:<RabbitMQ密码>@127.0.0.1:5672/k12
```

本地完全不配置内部密钥时，Python 会允许 Java 调用；团队共享或服务器环境必须配置。
密钥只能进入环境变量或 Nacos，不能提交到 Git。

`K12_AGENT_RABBITMQ_URL` 的账号、密码和虚拟主机必须与
`deploy/rabbitmq/.env` 一致。密码包含 `@`、`:`、`#`、`/` 等 URL 特殊字符时必须进行
百分号编码，例如 `@` 写成 `%40`。

## 3. 启动顺序

```powershell
# 终端一：启动 Python Runtime（测试 SYNC 时需要）
cd D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
uv run uvicorn k12_agent_runtime.main:app --host 127.0.0.1 --port 8090

# 终端二：启动 Python RabbitMQ Worker（测试 ASYNC 时需要）
uv run k12-agent-worker

# 终端三：启动 IAM
cd D:\CodeWorkPlace\k12\backend
mvn -pl k12-iam-service -am spring-boot:run

# 终端四：启动 Agent Service
mvn -pl k12-agent-service -am spring-boot:run

# 终端五：启动 Gateway
mvn -pl k12-gateway-service -am spring-boot:run
```

使用 IDEA 时可以分别运行 `K12IamServiceApplication`、`K12AgentServiceApplication` 和
`K12GatewayServiceApplication`，不要求另外安装 Maven。Agent Service 的 Run Configuration
必须填写本节 Java 环境变量。

数据库必须已经执行：

```text
backend/sql/mysql/k12_business_init.sql
```

旧数据库执行：

```text
backend/sql/mysql/k12_business_agent_upgrade.sql
```

## 4. 对外接口

### 4.1 运行智能体

```http
POST /api/v1/agents/study-plan/runs
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "inputText": "帮我制定八年级数学一次函数复习计划",
  "sessionId": "session-demo-001",
  "executionMode": "SYNC",
  "context": {
    "grade": "八年级",
    "durationMinutes": 40,
    "weakPoints": ["函数图像"]
  }
}
```

`userId` 不在请求体中。Java 从 JWT 的 `userId` claim 中读取，防止用户伪造其他账号。

当前接口是同步模式：Java 等待 Python 返回结果后再响应，适合学习计划、短问答和小型图表。
将 `executionMode` 改为 `ASYNC` 后，Java 返回 HTTP 202 和 `PENDING`，Python Worker 从
RabbitMQ 处理任务并把结果发回 Java。文档解析、批量任务和长时间沙箱执行应使用异步模式，
不要让同步 HTTP 长时间等待。

异步链路：

```text
Java 保存 PENDING -> 发布 request queue -> Python Worker 执行
-> 发布 result queue -> Java 幂等更新运行记录和产物 -> 前端轮询详情
```

RabbitMQ 消息可能重复投递。Java 更新结果时会锁定 `agent_run`，已进入终态的运行不会再次
写入产物。Python 的原始异常不会直接返回前端，避免泄露内部路径、密钥或模型信息。

### 4.2 查询运行记录

```text
GET /api/v1/agents/runs?page=1&size=20
GET /api/v1/agents/runs/{runId}
GET /api/v1/agents/runs/{runId}/artifacts
```

普通用户只能读取自己的记录。管理员可以读取全部记录。对无权查看的 `runId` 统一返回 404，
不向调用者暴露该运行是否属于其他用户。

## 5. Apifox 测试步骤

1. 重新导入 `backend/openapi/k12-api-openapi.json`。
2. 调用 `POST /api/v1/iam/auth/login` 获取 `accessToken`。
3. 在 Apifox 环境的 Bearer Token 中填入 `accessToken`。
4. 先调用 `GET /api/v1/agents`，确认存在 `study-plan` 或 `demo-chart` 且状态为 `ENABLED`。
5. 调用 `POST /api/v1/agents/{agentCode}/runs`。
6. 使用返回的 `runId` 查询详情和产物。

异步联调请求体示例：

```json
{
  "inputText": "生成一份八年级数学学习计划",
  "sessionId": "async-demo-001",
  "executionMode": "ASYNC",
  "context": {
    "grade": "八年级",
    "durationMinutes": 40,
    "weakPoints": ["一次函数"]
  }
}
```

首次请求返回 `202` 和 `PENDING`。随后轮询运行详情，正常状态变化为
`PENDING -> RUNNING -> SUCCEEDED`；失败则为 `PENDING -> RUNNING -> FAILED`。
Worker 开始消息将 `started_time` 写入数据库，完成消息也携带该时间作为兜底。

### 5.1 取消、超时与人工重试

新增接口（均需 Bearer JWT，权限为 `agent:invoke` 或 `ROLE_ADMIN`）：

```text
POST /api/v1/agents/runs/{runId}/cancel
POST /api/v1/agents/runs/{runId}/retry
```

取消只支持异步的 `PENDING`/`RUNNING`，重复取消返回原 `CANCELLED` 记录。
已成功、失败或超时的任务返回 409。普通用户只能取消自己的任务，其他用户的编号返回 404。
当前取消是业务状态取消：Java 不再采纳迟到的输出，不会停止 Python 进程或从队列删除消息。
Worker 的协作取消和沙箱中断属于后续 Python 阶段。

重试只支持失败或超时的异步任务，保留旧记录并创建新 `runId`，使用当前调用者的 JWT 身份。
每次调用都会创建新任务，不要在 HTTP 客户端自动重试该 POST。管理员重试他人的任务，
新记录属于管理员。超时任务在 Worker 端可能还在运行，有外部写操作的任务必须确认后再重试。

Java 定时任务每 30 秒扫描最多 100 条候选运行，逐条取得数据库行锁后重新判断是否超时。
排队上限默认 3600 秒，执行上限默认 900 秒；可通过以下环境变量配置：

```dotenv
K12_AGENT_LIFECYCLE_ENABLED=true
K12_AGENT_QUEUE_TIMEOUT_SECONDS=3600
K12_AGENT_EXECUTION_TIMEOUT_SECONDS=900
K12_AGENT_SCAN_INTERVAL_MS=30000
```

Worker 未启动导致的排队在一小时以内不会被标记超时。超过上限后分别记录
`QUEUE_TIMEOUT` 或 `EXECUTION_TIMEOUT`，状态为 `TIMED_OUT`。所有本地终态都有结束时间。
取消、超时和正常结果通过同一张表的行锁协调，迟到的开始/结果消息不会覆盖终态。

已有数据库包含 `started_time`、状态字段和 `status, created_time` 索引，此次不需要升级 SQL。
重启 Java Agent 服务即可加载新接口和调度配置；开始时间仍需要此前已更新的 Worker。

### 5.2 消息投递保障与边界

Java 发布开启 correlated confirm、publisher returns 和 mandatory。Broker 拒收、没有匹配
队列时不报告投递成功。等待确认超过 5 秒时，保留原 `PENDING` 并返回该 runId：任务可能已经
被 Broker 接收，不能直接标记失败并自动重发。后续由 Worker 结果或超时扫描结束任务。

目前还没有事务 Outbox。数据库保存成功后 Java 在发布前宕机，任务最终会被排队超时回收，
但不会自动补发；这不是恰好执行一次的保证。后续补 Outbox 时必须同时实现 Worker 去重，
否则重复投递可能重复调用有副作用的工具。

参考：[Spring AMQP 确认与返回消息 API](https://docs.spring.io/spring-amqp/api/org/springframework/amqp/rabbit/connection/CorrelationData.html)。

常见返回：

| HTTP 状态 | 含义 |
|---:|---|
| 201 | SYNC 执行完成，运行和产物已经保存 |
| 202 | ASYNC 任务已进入队列，可通过运行详情轮询状态 |
| 400 | 请求字段格式或分页参数错误 |
| 401 | JWT 缺失、无效或过期 |
| 403 | 没有 `agent:invoke` 或 `agent:read` |
| 404 | 智能体配置或可见运行记录不存在 |
| 409 | 智能体存在但未启用 |
| 502 | Python 返回值不符合双方约定的内部契约 |
| 503 | Python Runtime 不可达、异步功能未启用或 RabbitMQ 发布失败 |

## 6. 新增一个 Agent 时怎么做

1. 在 Python 中实现 `AgentExecutor`，并在 Runtime 注册器中登记稳定 `code`。
2. 在 `agent_config` 创建同名 `code`，例如 `math-tutor`。
3. 不在 `config_json` 中保存模型密钥，只保存非敏感业务配置。
4. 用 Java 对外接口运行，确认 `agent_run` 和 `agent_artifact` 正常落库。
5. 为 Java 契约和 Python Agent 分别补单元测试。

Java 的 `agent_config.code` 与 Python 的 `AgentExecutor.code` 必须完全一致。数据库有配置但
Python 未注册执行器时，调用会失败；Python 有执行器但数据库没有启用配置时，Java不会放行。
