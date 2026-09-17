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

# teaching-assistant 个性化上下文需要访问这两个Java服务
$env:K12_IAM_SERVICE_URL = "http://127.0.0.1:8081"
$env:K12_LEARNING_SERVICE_URL = "http://127.0.0.1:8082"
$env:K12_ASSESSMENT_SERVICE_URL = "http://127.0.0.1:8084"

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
# 只有需要真实调用代码沙箱时才启用。该值会覆盖 .env 中的同名配置。
$env:K12_AGENT_SANDBOX_ENABLED = "true"
uv run k12-agent-runtime

# Runtime也会读取ai-services/k12-agent-runtime/.env；环境变量同名时优先使用环境变量。
# 本地要走腾讯云，确认K12_AGENT_SANDBOX_ENABLED=true且PROVIDER=tencent_agsx。

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
`K12AssessmentServiceApplication`、`K12GatewayServiceApplication`，不要求另外安装 Maven。
Agent Service 的 Run Configuration 必须填写本节 Java 环境变量。

## 4. 常见联调错误

### Java 调用 Python 返回 401，前端看到 503

说明 Python 已配置 `K12_AGENT_INTERNAL_API_KEY`，但 Java 进程没有配置相同值，或仍在使用
重启前的旧环境变量。检查 IDEA 的 `K12AgentServiceApplication` Run Configuration：

```text
K12_AGENT_INTERNAL_API_KEY=<必须与 Python .env 完全一致>
```

修改后必须重启 Agent Service。不要把真实密钥写入 `application.yml` 或提交到 Git。

腾讯云同步执行首次启动解释器可能超过10秒。当前公开接口默认允许30秒代码执行，Runtime的
供应商创建请求预算为30秒，Java Feign读取预算为90秒。更新`application.yml`后需要重启IDEA
中的`K12AgentServiceApplication`才能加载新的Feign配置；前端推荐使用异步模式避免长时间等待。
Python Runtime应由IDEA或本机终端在具备腾讯云出站权限的网络环境启动。若旧进程占用8090，
先核对进程归属并停止旧Runtime；不能通过更换业务代码绕过受限工具沙箱的网络策略。
代码实验页默认使用`ASYNC`，还必须在同样具备腾讯云出站权限的环境启动
`uv run k12-agent-worker`，并确认RabbitMQ已启动。只启动8090的HTTP Runtime，异步任务会
停留在`PENDING`直至Worker消费或超时扫描处理。

### 腾讯云沙箱创建实例超时

先直接检查 `https://api.<地域>.tencentags.com` 的网络连通性、控制台沙箱状态、模板 ID、
API Key 和地域是否一致。超时不代表 Java、RabbitMQ 或 MinIO 故障；Java 会将供应商异常收敛为
503，详细原因只记录在 Python Runtime 控制台。

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
  "inputText": "帮我制定八年级人工智能通识课的排序算法复习计划",
  "sessionId": "session-demo-001",
  "executionMode": "SYNC",
  "context": {
    "grade": "八年级",
    "durationMinutes": 40,
    "weakPoints": ["相邻比较", "交换过程"]
  }
}
```

`userId` 不在请求体中。Java 从 JWT 的 `userId` claim 中读取，防止用户伪造其他账号。

### 4.1.1 Teaching Assistant 个性化上下文

调用`teaching-assistant`时，Agent Service会额外完成：

1. 携带当前Bearer Token调用IAM当前用户学习画像；
2. 携带同一Token调用Learning当前用户最近5门课程进度；
3. 调用Assessment当前用户最近5条学习结果；
4. 用服务端画像覆盖请求中的`stage`、`grade`、`textbook`和`interests`；
5. 只保留课程进度和作业摘要，不读取或传递答案；
6. 从低于60分的结果推导`knownWeakPoints`；
7. 同步调用和RabbitMQ异步消息复用同一份已清理上下文。

三个下游客户端默认连接超时1.5秒、读取超时2.5秒。IAM画像不存在或任一下游不可用时，
Agent调用继续执行，并在`context.personalization`标记降级状态。不要把这些接口改成失败即终止，
否则一个非关键画像服务会导致整个教学问答不可用。

用户JWT只发送给IAM、Learning和Assessment；Python Runtime只接收内部API Key。Feign配置类刻意分开，
禁止将Bearer转发拦截器或Runtime内部密钥拦截器注册为全局Feign配置。

### 4.1.2 多轮会话与刷新恢复

请求携带稳定的`sessionId`后，Java会从`agent_run`读取当前JWT用户、同一`agentCode`和同一
`sessionId`最近6条成功运行，以时间正序写入`context.conversationHistory`。客户端传入的
`conversation`和`conversationHistory`会被服务端删除并重建，不能用于伪造其他用户的对话。

```http
GET /api/v1/agents/teaching-assistant/sessions/session-demo-001/history?limit=20
Authorization: Bearer <JWT>
```

该接口仅返回当前用户的提问、回答、公开输出元数据和产物，不返回运行时`inputContext`。历史
响应和传给模型的文本都会限长。旧数据库重新执行
`backend/sql/mysql/k12_business_agent_session_index_check.sql`检查组合索引；结果为空时再执行
`backend/sql/mysql/k12_business_agent_session_index_upgrade.sql`。若出现
`Packet for query is too large (... > 2,048)`，说明MySQL服务端被错误设置为2KB。先用管理员账号
单独执行`backend/sql/mysql/mysql_server_packet_fix.sql`，断开并新建数据库连接，再执行
`backend/sql/mysql/mysql_server_packet_verify.sql`。两列均为`67108864`后才能继续执行升级脚本。
数据库软件中使用“执行当前语句”，避免批量执行引发JDBC的`Statement closed`错误。

当前“会话”是成功运行记录的只读视图，不是独立聊天表。尚未实现会话列表、重命名、删除、
长期摘要和LangGraph Checkpointer。切换新的`sessionId`即可开始一段新对话。

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
  "inputText": "生成一份八年级人工智能通识课学习计划",
  "sessionId": "async-demo-001",
  "executionMode": "ASYNC",
  "context": {
    "grade": "八年级",
    "durationMinutes": 40,
    "weakPoints": ["排序算法"]
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

重试只支持失败或超时的普通异步Agent任务，保留旧记录并创建新 `runId`，使用当前调用者的 JWT 身份。
`code-tutor`代码任务必须重新调用代码执行接口，不能从普通重试入口绕过代码专用校验。
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

### 5.3 代码沙箱接入进度（2026-09-15）

Java内部调用层已经完成：

- `AgentRuntimeClient.executeCode`调用Python的`POST /internal/v1/sandbox/executions`；
- `RuntimeCodeExecutionRequest`固定发送代码、1到30秒超时和空依赖列表；
- `RuntimeCodeExecutionResponse`接收stdout、stderr、退出码、耗时和Artifact；
- `CodeExecutionService`要求`ROLE_ADMIN`或`agent:invoke`，并在Java侧重复校验代码和超时；
- Runtime返回空数据、非200业务响应或缺少必要字段时转换为502。

同步和异步代码执行共用一个公开接口：

```http
POST /api/v1/agents/code-executions
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "code": "print('hello k12')",
  "timeoutSeconds": 30,
  "executionMode": "SYNC"
}
```

该接口需要`ROLE_ADMIN`或`agent:invoke`。Gateway已有`/api/v1/agents/**`通配路由，无需增加单独
路由。Java不会向前端返回云厂商`providerRequestId`，图片和文件只返回受控Artifact信息。

`SYNC`模式下，Java先生成平台`runId`并写入`RUNNING`记录，再在事务外调用Python Runtime；
返回后用短事务把状态收敛为`SUCCEEDED`、`FAILED`、`TIMED_OUT`或`REJECTED`，同时写入
`agent_artifact`。Runtime 503和协议错误也会留下脱敏失败记录。

`ASYNC`模式下，Java先保存`PENDING`并向`k12.code.execute.request`发送代码专用消息，然后返回
HTTP 202。Python Worker发送`RUNNING`通知、复用`ExecuteCodeUseCase`执行同一套沙箱逻辑，再向
`k12.code.execute.result`发送终态。Java结果消费者按`runId`加锁并幂等写入状态和Artifact。

```json
{
  "code": "print('hello async k12')",
  "timeoutSeconds": 30,
  "executionMode": "ASYNC"
}
```

首次响应的`data.status`为`PENDING`且`executionId`为空。使用
`GET /api/v1/agents/runs/{runId}`轮询，正常状态为
`PENDING -> RUNNING -> SUCCEEDED`。公开响应中的`runId`属于K12平台；`executionId`仅代表
Runtime内部执行。

`agentCode=code-tutor`是运行记录中的系统保留分类，不写入`agent_config`，因此不会被普通
`/agents/{agentCode}/runs`入口误调用，也不需要新增智能体配置记录。普通Agent和代码执行使用不同
队列与消息DTO，但共享`k12.agent`交换机、死信拓扑和一个Python Worker进程。

### 代码执行日配额

代码沙箱已有单次超时、代码长度、输出与文件产物上限。日配额额外限制同一登录用户
在北京时间自然日内发起的代码执行次数，`SYNC`和`ASYNC`共用同一计数。先以具备建表权限
的账号，在数据库软件中**单独执行**`backend/sql/mysql/k12_business_code_execution_quota.sql`；
确认`k12_business.code_execution_quota`存在后，再给Agent Service配置并重启：

```powershell
$env:K12_AGENT_CODE_QUOTA_ENABLED = "true"
$env:K12_AGENT_CODE_DAILY_LIMIT = "5"
```

默认关闭是为了不影响尚未升级的环境。启用后，MySQL对`(user_id, quota_date)`主键行进行
条件更新，多个Java实例共享计数，达到上限返回HTTP 429。无效参数和未启用的异步模式不会
扣次数；提交已受理后即计一次，执行失败、取消或上游不可用不退还，避免重复请求放大云费用。
默认日上限为5，配置允许1到50次；纯本地联调可显式设置20次，但云演示建议保持5次。
启用后若配额表或数据库不可用，则返回503，不绕过限制。每天无需手工重置，新日期自动使用
新行。此限制仅覆盖Java公开的代码执行入口；Runtime内部接口仍须使用内部密钥并禁止公网访问。
跨实例并发名额、长期历史清理和云平台账单告警尚未完成。
沙箱容量范围和零云费用压测步骤见
[代码沙箱容量与压测手册](../../ai-services/k12-agent-runtime/docs/code-sandbox-load-test-guide.md)。
可以在数据库软件里用以下只读语句检查用量；实际执行一次代码会占用一次配额，
不要用真实云沙箱循环压测来验证429：

```sql
SELECT user_id, quota_date, used_count
FROM k12_business.code_execution_quota
ORDER BY quota_date DESC, user_id
LIMIT 20;
```

当前后端基础闭环已经覆盖同步和异步代码执行，但前端代码编辑器、协作取消、云端配额联调和
恶意代码安全测试集仍未完成，不能描述成完整代码教学产品。本阶段没有调用腾讯云付费沙箱。
2026-09-16回归结果：Backend完整Maven反应堆7个模块共138个测试通过，Python Runtime Ruff
检查和54个测试通过。使用本地RabbitMQ完成一次真实异步消息联调：HTTP 202、PENDING、RUNNING、
脱敏FAILED及开始/结束时间持久化均符合协议；为避免费用，联调Worker显式关闭了真实云沙箱。

常见返回：

| HTTP 状态 | 含义 |
|---:|---|
| 200 | SYNC 执行完成，运行和产物已经保存 |
| 202 | ASYNC 任务已进入队列，可通过运行详情轮询状态 |
| 400 | 请求字段格式或分页参数错误 |
| 401 | JWT 缺失、无效或过期 |
| 403 | 没有 `agent:invoke` 或 `agent:read` |
| 404 | 智能体配置或可见运行记录不存在 |
| 409 | 智能体存在但未启用 |
| 429 | 已达到当天代码执行次数上限 |
| 502 | Python 返回值不符合双方约定的内部契约 |
| 503 | Python Runtime 不可达、异步功能未启用、RabbitMQ 发布失败或配额存储不可用 |

## 6. AI 课堂小测记录

`teaching-assistant` 返回的 `application/vnd.k12.quiz.v1+json` 产物可由学生在用户端提交。
Assessment 根据当前 JWT 用户读取 Agent Service 中本人已完成的运行及持久化题目，在服务端判分；
不接受前端提供的分数或正确答案。同一学生、同一 `runId` 只能提交一次；重复提交相同答案
返回已有结果，提交不同答案返回 409。近期记录会进入下一轮教学上下文，低于 60% 的练习
将其首个错题知识点纳入薄弱点。

部署顺序：

1. 在业务 MySQL 执行 `backend/sql/mysql/k12_business_ai_practice.sql`，确认
   `k12_business.assessment_ai_practice_attempt` 已创建。脚本只建表，不清理已有数据。
2. Assessment Service 配置 `K12_AGENT_SERVICE_URL`（默认 `http://127.0.0.1:8083`），
   确保它能访问 Agent Service；重启 Assessment、Agent Service 和 Python Worker，再更新用户端。
3. 用学生 JWT 创建一次 `teaching-assistant` 同步运行，取返回的 `runId` 和小测题目，调用
   `POST /api/v1/assessments/practice-attempts`：

```json
{
  "runId": "教学运行返回的 runId",
  "answers": [
    {"questionId": "q1", "optionId": "a"},
    {"questionId": "q2", "optionId": "b"}
  ]
}
```

`GET /api/v1/assessments/practice-attempts/runs/{runId}/me` 可恢复该轮结果；
`GET /api/v1/assessments/practice-attempts/me?limit=5` 可查看最近记录。两个查询只返回本人数据。
`GET /api/v1/assessments/practice-attempts/me/insights` 返回本人近期小测的按主题汇总与下一步建议。
`GET /api/v1/assessments/practice-attempts/me/mastery` 返回本人按稳定知识点编码累计的练习掌握参考。
这五个接口已写入 `backend/openapi/k12-api-openapi.json`，可重新导入 Apifox。

知识点掌握度升级（新小测启用前执行）：

1. 在数据库软件里先执行 `backend/sql/mysql/k12_business_ai_mastery_check.sql`。
2. 若 `knowledge_code_column_exists=0`，单独执行
   `backend/sql/mysql/k12_business_ai_mastery_upgrade.sql` 中的 `ALTER TABLE`；若为 1，不要重做 ALTER。
3. 单独执行同一文件的 `CREATE TABLE IF NOT EXISTS`。两条语句分开执行，避免客户端批量执行问题。
4. 再运行检查脚本，两个结果都应为 1；之后重启 Assessment、Agent Service 和 Python Runtime。
   若使用异步 Agent，还需重启 Python Worker。

新题目产物含 `knowledgeCode=sorting.bubble_sort`；Assessment 以本人 JWT 和已持久化题目判分，
新练习与知识点累计在同一事务内提交，相同答案重试只返回原记录，不重复累计。累计百分比按
`总得分/总满分`计算，低于 60% 补基础，达到 80% 增加进阶题。旧产物没有编码仍可判分，
但不会按标题猜测知识点或回填掌握度；旧练习继续出现在近期建议中。当前仅支持冒泡排序
知识点，后续新主题须先定义稳定编码及经过审核的对应题目。该比例是形成性练习参考，
不是正式学业评价或可信的长期能力模型。

学习建议读取最近 50 次记录，最多展示 5 个主题，每个主题最多计算最近 5 次；平均百分比
按实际得分和满分加权计算。最近一次或平均分低于 60% 建议复习，低于 80% 建议再练习，
否则建议应用到编程实践。没有练习时返回空数组。新小测按知识点编码聚合；旧小测仍按标题
聚合，并去掉固定的“课堂小测”后缀。

当前题目产物包含正确选项供前端即时反馈，因此属于**形成性练习**，不计入作业或考试成绩，
也不适合作为防作弊测评。正式考试需要另设不向客户端暴露答案的题库、发布与判分流程。
当前完成了单次结果、薄弱点、近期规则化建议和单知识点的累计练习比例；尚未实现跨主题的
正式能力模型、教师统计、跨课程主动推荐或练习质量校准。

2026-09-17 本地真实 HTTP 联调：Gateway、IAM、Agent Service、Assessment 健康检查均为 UP；
未登录访问建议接口返回 401。用确定性 Python Runtime 新建一轮 `teaching-assistant` 运行，
返回动画和小测产物；提交测试答案后，Assessment 保存 `0/20`，按运行恢复和近期列表均可读取，
主题建议返回 `REVIEW`；下一轮教学上下文读取到 1 条练习和 1 个薄弱点。
联调还发现 MySQL JSON 列会重新序列化答案，原先按原始字符串比较导致相同答案重试返回
409；现已改为解析后的映射比较。修复后的临时 Assessment 实例验证相同答案返回原记录，
不同答案仍返回 409。临时实例和测试 Runtime 已停止。用户重启 Assessment 后再次经 Gateway
验证：相同答案返回原记录 `id=1`、不同答案 409，近期记录仍仅 1 条。

掌握度这批是之后新增的代码。迁移未在共享数据库执行前，不要重启新版 Assessment 并调用练习
接口；上面已验证的 HTTP 结果只覆盖旧小测及幂等修复，不代表新表已完成真实联调。

## 7. 新增一个 Agent 时怎么做

1. 在 Python 中实现 `AgentExecutor`，并在 Runtime 注册器中登记稳定 `code`。
2. 在 `agent_config` 创建同名 `code`，例如 `math-tutor`。
3. 不在 `config_json` 中保存模型密钥，只保存非敏感业务配置。
4. 用 Java 对外接口运行，确认 `agent_run` 和 `agent_artifact` 正常落库。
5. 为 Java 契约和 Python Agent 分别补单元测试。

Java 的 `agent_config.code` 与 Python 的 `AgentExecutor.code` 必须完全一致。数据库有配置但
Python 未注册执行器时，调用会失败；Python 有执行器但数据库没有启用配置时，Java不会放行。
