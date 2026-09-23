# K12 平台部署与本地联调指南

> 新服务器整体迁移、统一 Docker Compose、数据库建表和数据搬迁请优先阅读
> [新服务器整体迁移与部署手册](./server-migration-deployment.md)。本文后续内容主要保留本地开发与
> IDEA 联调方式。

本文面向从零搭建或给他人交接环境的同学。密钥、主机、密码等敏感项已用「待填写」留空，请按实际环境补全；**不要把填好的真实密码提交到 Git**。

更细的专题文档：

| 文档 | 用途 |
| --- | --- |
| [backend/README.md](../backend/README.md) | 后端模块、SQL 升级顺序 |
| [backend/docs/agent-java-integration-guide.md](../backend/docs/agent-java-integration-guide.md) | Java ↔ Python Agent 联调 |
| [backend/docs/neo4j-knowledge-graph.md](../backend/docs/neo4j-knowledge-graph.md) | 知识图谱 / Neo4j |
| [ai-services/k12-agent-runtime/README.md](../ai-services/k12-agent-runtime/README.md) | Python Runtime |
| [qianduan/README.md](../qianduan/README.md) | 前端启动 |
| [docs/demo-guide.md](./demo-guide.md) | 全流程演示脚本 |

---

## 1. 架构与端口一览

```text
浏览器
  ├─ user-app  :5173  ──┐
  └─ admin-app :5174  ──┼──► Gateway :8080
                        │       ├─ IAM         :8081  → MySQL k12_auth
                        │       ├─ Learning    :8082  → MySQL k12_business
                        │       │                 → Redis / MinIO / Neo4j（可选）
                        │       ├─ Agent       :8083  → MySQL k12_business
                        │       │                 → Agent Runtime :8090
                        │       │                 → RabbitMQ :5672（**必选**）
                        │       └─ Assessment  :8084  → MySQL k12_business
                        │
                        └─（可选）Piston :2000 / MinIO :9000
```

| 组件 | 默认端口 | 是否本仓库 Compose |
| --- | ---: | --- |
| Gateway | 8080 | 否 |
| IAM | 8081 | 否 |
| Learning | 8082 | 否 |
| Agent Service | 8083 | 否 |
| Assessment | 8084 | 否 |
| Agent Runtime (Python HTTP) | 8090 | 否 |
| Agent Worker (Python) | — | 否（消费 RabbitMQ） |
| user-app / admin-app | 5173 / 5174 | 否 |
| MySQL | 3306 | **否**（需自备） |
| **RabbitMQ** AMQP / 管理台 | 5672 / 15672 | **是（必选）**：`deploy/rabbitmq` |
| Redis | 6379 | **否**（可选） |
| MinIO | 9000 | **否**（可选，头像/封面/附件） |
| Neo4j Bolt | 7687 | **否**（可选，知识图谱） |
| Piston 代码沙箱 | 2000 | 是：`deploy/piston`（可选） |

**建议启动顺序：**

1. MySQL（必选）→ **RabbitMQ（必选）** → 可选 Redis / MinIO / Neo4j / Piston  
2. Python：**Runtime（8090）+ Worker**（见第 6.4 / 7.4 节）  
3. IAM → Learning → Assessment → Agent Service → Gateway  
4. 前端 `pnpm dev:user` / `pnpm dev:admin`

健康检查：

```text
GET http://localhost:8080/api/v1/gateway/health
GET http://localhost:8081/api/v1/iam/health
GET http://localhost:8082/api/v1/learning/health
GET http://localhost:8083/api/v1/agents/health
GET http://localhost:8084/api/v1/assessments/health
```

---

## 2. 环境前提

| 软件 | 版本要求 | 说明 |
| --- | --- | --- |
| JDK | **17** | Spring Boot 3.3 |
| Maven | 3.9+ | 或 IDEA 内置 Maven |
| Node.js | 20+ 建议 | 前端 |
| pnpm | 与仓库 lock 兼容 | `corepack enable` 后可用 |
| Python | **3.13.x**（`<3.14`） | Agent Runtime |
| uv | 最新稳定版 | Python 包管理 |
| Docker Desktop | **必装（本地起 RabbitMQ）** | 也用于可选的 Piston |
| MySQL | 8.x | 双库 `k12_auth` + `k12_business` |

---

## 3. MySQL 初始化

### 3.1 创建应用账号（用 root 或具备授权的账号）

```sql
CREATE USER IF NOT EXISTS 'k12'@'%' IDENTIFIED BY '<填：应用库密码>';
-- 生产建议把 '%' 改成应用服务器 IP
ALTER USER 'k12'@'%' IDENTIFIED BY '<填：应用库密码>';
```

初始化脚本会建库授权；**不会**自动创建平台登录账号 `admin`。

### 3.2 全新环境脚本顺序

在**同一会话**中按序执行（PowerShell 示例）：

```powershell
$mysql = "mysql -h <填：主机> -P 3306 -u root -p"

# 1) 权限库
Get-Content D:\CodeWorkPlace\k12\backend\sql\mysql\k12_auth_init.sql -Raw -Encoding UTF8 | & mysql ...

# 2) 业务库（含课程 / Agent / 作业等基础表）
Get-Content D:\CodeWorkPlace\k12\backend\sql\mysql\k12_business_init.sql -Raw -Encoding UTF8 | & mysql ...
```

或在 Navicat / DataGrip / MySQL Workbench 中打开脚本整份执行。

### 3.3 已有库升级（幂等增量）

先备份，再建议顺序：

1. `k12_business_agent_upgrade.sql`
2. `k12_business_homework_workflow_upgrade.sql`
3. `k12_auth_permission_upgrade.sql`
4. `k12_auth_learning_profile_upgrade.sql`
5. 按需：`k12_business_learning_upgrade.sql`、`k12_business_teaching_resource*.sql`、`k12_business_ai_practice.sql`、`k12_business_ai_mastery_upgrade.sql`、`k12_agent_python_code_coach.sql`、`k12_business_code_execution_quota.sql` 等

权限升级后请**重新登录**，使 JWT 带上新权限。

### 3.4 包大小（长章节正文）

若 `max_allowed_packet` 过小，先执行：

- `backend/sql/mysql/mysql_server_packet_fix.sql`
- `backend/sql/mysql/mysql_server_packet_verify.sql`（两列均为 `67108864`）

### 3.5 首个管理员账号

初始化 SQL **不创建**登录用户。任选其一：

- 用已有环境里的管理员账号；或  
- 临时用 SQL / 管理端接口创建（见 [demo-guide.md](./demo-guide.md) 账号准备节）。

数据库账号 `k12` ≠ 平台登录账号。

---

## 4. 中间件

> **RabbitMQ 为平台必选依赖**（与 Python Worker、Java Agent 异步任务联调一致）。其余 Redis / MinIO / Neo4j / Piston 仍可按功能开关。

### 4.1 Redis（Learning 缓存：排行榜 / 封面 URL / 已发布课列表 / 图谱概览）

自备 Redis 后，在 Learning 的环境变量中打开 `K12_REDIS_ENABLED=true`。未开启时功能仍可用，只是不走缓存。

### 4.2 MinIO（课程封面、教学资料、作业附件、用户头像）

仓库**不提供** MinIO Compose，需自行安装（本机或远端）。

约定：

| 用途 | 环境变量 | 默认桶名 |
| --- | --- | --- |
| 课程 / 资料 / 作业 / Agent 文件 | `K12_MINIO_BUCKET` | `k12-agent-artifacts` |
| 用户头像（IAM） | `K12_AVATAR_MINIO_BUCKET` | `k12-user-avatars`（不存在时服务会尝试自动建桶） |

总开关：`K12_COURSE_MEDIA_ENABLED=true`（IAM / Learning / Assessment 共用此名；Assessment 附件也可跟此开关）。

`K12_MINIO_PUBLIC_ENDPOINT`：浏览器实际能打开的地址（若 MinIO 在内网、前端在本机，需填可访问的公网或映射地址）。

### 4.3 Neo4j（知识图谱）

自备 Neo4j，Learning 中设 `K12_NEO4J_ENABLED=true`。Cypher 与一键初始化说明见 `backend/docs/neo4j-knowledge-graph.md`。

### 4.4 RabbitMQ（**必选**）

本地部署**必须**先启动 RabbitMQ，再启动 Python Worker 与开启了 MQ 的 Java Agent。未部署时 Worker 无法消费，异步代码执行 / 长任务链路不可用。

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\rabbitmq
Copy-Item .env.example .env
# 编辑 .env 修改密码后：
docker compose up -d
docker compose ps
```

| 项 | 值 |
| --- | --- |
| AMQP | `127.0.0.1:5672` |
| 管理台 | <http://127.0.0.1:15672> |
| 默认用户 / 虚拟主机 | `k12` / `k12`（密码以 `deploy/rabbitmq/.env` 为准） |

Java 侧打开 `K12_AGENT_RABBITMQ_ENABLED=true`，并配置 `K12_RABBITMQ_*`。  
Python `.env` 中 `K12_AGENT_RABBITMQ_ENABLED=true`，`K12_AGENT_RABBITMQ_URL` 与上述账号一致（密码含 `@` 等需 URL 编码）。

详见 `deploy/rabbitmq/README.md`。

### 4.5 Piston（本地代码沙箱备用）

```powershell
Set-Location D:\CodeWorkPlace\k12\deploy\piston
docker compose up -d
```

默认 `http://127.0.0.1:2000`。详见 `deploy/piston/README.md`。

### 4.6 PostgreSQL pgvector（仅 Runtime RAG）

需要教学资料向量检索时，自备 PostgreSQL，执行  
`ai-services/k12-agent-runtime/sql/001_init_pgvector.sql`，并在 Runtime `.env` 填写 `K12_AGENT_RAG_*`。

---

## 5. 环境变量清单（请填写）

> **原则：** 全服务 `K12_JWT_SECRET` 必须一致；IAM 的 `K12_AUTH_DB_*` 与业务三服务的 `K12_BUSINESS_DB_*` 分别指向正确库；Agent 与 Runtime 的 `K12_AGENT_INTERNAL_API_KEY` 必须一致。  
> 仓库 `application.yml` 里可能带有远程开发默认主机，**部署时务必用环境变量覆盖**，不要依赖默认值进生产。

### 5.1 全服务共用

| 变量 | 待填写值 | 说明 |
| --- | --- | --- |
| `K12_JWT_ISSUER` | `k12-platform` 或 ______ | 建议各服务相同 |
| `K12_JWT_SECRET` | ______ | **生产必改**，足够长 |
| `K12_JWT_ACCESS_TOKEN_TTL` | `30m` 或 ______ | 可选 |
| `NACOS_DISCOVERY_ENABLED` | `false` | 本地通常关 |
| `NACOS_CONFIG_ENABLED` | `false` | 本地通常关 |
| `NACOS_SERVER_ADDR` | ______ | 启用 Nacos 时填写 |

### 5.2 IAM（8081）— 权限库 + 头像

| 变量 | 待填写值 |
| --- | --- |
| `K12_AUTH_DB_HOST` | ______ |
| `K12_AUTH_DB_PORT` | `3306` 或 ______ |
| `K12_AUTH_DB_NAME` | `k12_auth` |
| `K12_AUTH_DB_USERNAME` | `k12` 或 ______ |
| `K12_AUTH_DB_PASSWORD` | ______ |
| `K12_COURSE_MEDIA_ENABLED` | `true` / `false` |
| `K12_MINIO_ENDPOINT` | ______（例：`http://127.0.0.1:9000`） |
| `K12_MINIO_PUBLIC_ENDPOINT` | ______（浏览器可达；可与上相同） |
| `K12_MINIO_ACCESS_KEY` | ______ |
| `K12_MINIO_SECRET_KEY` | ______ |
| `K12_AVATAR_MINIO_BUCKET` | `k12-user-avatars` 或 ______ |
| `K12_AVATAR_URL_TTL` | `1h` 或 ______ |

### 5.3 Learning（8082）— 业务库 + 可选 Redis / MinIO / Neo4j

| 变量 | 待填写值 |
| --- | --- |
| `K12_BUSINESS_DB_HOST` | ______ |
| `K12_BUSINESS_DB_PORT` | `3306` 或 ______ |
| `K12_BUSINESS_DB_NAME` | `k12_business` |
| `K12_BUSINESS_DB_USERNAME` | `k12` 或 ______ |
| `K12_BUSINESS_DB_PASSWORD` | ______ |
| `K12_REDIS_ENABLED` | `true` / `false` |
| `K12_REDIS_HOST` | ______ |
| `K12_REDIS_PORT` | `6379` 或 ______ |
| `K12_REDIS_USERNAME` | ______（可空） |
| `K12_REDIS_PASSWORD` | ______（可空） |
| `K12_REDIS_DATABASE` | `0` 或 ______ |
| `K12_COURSE_MEDIA_ENABLED` | 与 IAM 一致建议 |
| `K12_MINIO_ENDPOINT` | ______ |
| `K12_MINIO_PUBLIC_ENDPOINT` | ______ |
| `K12_MINIO_ACCESS_KEY` | ______ |
| `K12_MINIO_SECRET_KEY` | ______ |
| `K12_MINIO_BUCKET` | `k12-agent-artifacts` 或 ______ |
| `K12_NEO4J_ENABLED` | `true` / `false` |
| `K12_NEO4J_URI` | ______（例：`bolt://127.0.0.1:7687`） |
| `K12_NEO4J_USERNAME` | `neo4j` 或 ______ |
| `K12_NEO4J_PASSWORD` | ______ |
| `K12_NEO4J_DATABASE` | `neo4j` 或 ______ |
| `K12_NEO4J_SEED_ON_STARTUP` | `true` / `false` |
| `K12_AGENT_RUNTIME_URL` | `http://127.0.0.1:8090` 或 ______ |
| `K12_AGENT_INTERNAL_API_KEY` | ______（与 Python 一致） |
| `K12_IAM_TOKEN_STATE_URL` | `http://127.0.0.1:8081/api/v1/iam/auth/token-state` |

JWT 两项同 5.1。

### 5.4 Agent Service（8083）

| 变量 | 待填写值 |
| --- | --- |
| `K12_BUSINESS_DB_HOST` | ______（同 Learning） |
| `K12_BUSINESS_DB_PORT` | ______ |
| `K12_BUSINESS_DB_NAME` | `k12_business` |
| `K12_BUSINESS_DB_USERNAME` | ______ |
| `K12_BUSINESS_DB_PASSWORD` | ______ |
| `K12_AGENT_RUNTIME_URL` | `http://127.0.0.1:8090` |
| `K12_AGENT_INTERNAL_API_KEY` | ______ |
| `K12_IAM_SERVICE_URL` | `http://127.0.0.1:8081` |
| `K12_LEARNING_SERVICE_URL` | `http://127.0.0.1:8082` |
| `K12_ASSESSMENT_SERVICE_URL` | `http://127.0.0.1:8084` |
| `K12_AGENT_RABBITMQ_ENABLED` | `true`（**必开**） |
| `K12_RABBITMQ_HOST` | `127.0.0.1` 或 ______ |
| `K12_RABBITMQ_PORT` | `5672` 或 ______ |
| `K12_RABBITMQ_USERNAME` | `k12` 或 ______ |
| `K12_RABBITMQ_PASSWORD` | ______ |
| `K12_RABBITMQ_VHOST` | `k12` 或 ______ |
| `K12_JWT_SECRET` | ______（同全服务） |

### 5.5 Assessment（8084）

| 变量 | 待填写值 |
| --- | --- |
| `K12_BUSINESS_DB_*` | 同 Learning |
| `K12_IAM_SERVICE_URL` | `http://127.0.0.1:8081` |
| `K12_AGENT_SERVICE_URL` | `http://127.0.0.1:8083` |
| `K12_COURSE_MEDIA_ENABLED` / `K12_ASSESSMENT_ATTACHMENTS_ENABLED` | ______ |
| `K12_MINIO_*` | 同 Learning（开附件时） |
| `K12_JWT_SECRET` | ______ |

### 5.6 Gateway（8080）

| 变量 | 待填写值 |
| --- | --- |
| `K12_IAM_SERVICE_URI` | `http://localhost:8081` 或 ______ |
| `K12_LEARNING_SERVICE_URI` | `http://localhost:8082` 或 ______ |
| `K12_AGENT_SERVICE_URI` | `http://localhost:8083` 或 ______ |
| `K12_ASSESSMENT_SERVICE_URI` | `http://localhost:8084` 或 ______ |
| `K12_JWT_SECRET` | ______ |
| `K12_JWT_ISSUER` | ______ |

无数据库。前端只访问 Gateway，不要把 8081–8084 暴露给浏览器（本地开发除外）。

### 5.7 Python Agent Runtime（`.env`，勿提交）

```powershell
cd D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
Copy-Item .env.example .env
```

必填 / 常用项（完整模板见 `.env.example`）：

| 变量 | 待填写值 |
| --- | --- |
| `K12_AGENT_LLM_API_KEY` | ______（百炼 / DashScope） |
| `K12_AGENT_LLM_MODEL` | `qwen-plus` 或 ______ |
| `K12_AGENT_INTERNAL_API_KEY` | ______（与 Java 一致） |
| `K12_AGENT_RAG_ENABLED` | `true` / `false` |
| `K12_AGENT_RAG_DATABASE_URL` | ______（开 RAG 时） |
| `K12_AGENT_REDIS_ENABLED` | `true` / `false` |
| `K12_AGENT_REDIS_URL` | ______ |
| `K12_AGENT_RABBITMQ_ENABLED` | `true`（**必开**，需已部署 RabbitMQ） |
| `K12_AGENT_RABBITMQ_URL` | ______（例：`amqp://k12:<密码>@127.0.0.1:5672/k12`，特殊字符 URL 编码） |
| `K12_AGENT_SANDBOX_ENABLED` | `true` / `false` |
| `K12_AGENT_SANDBOX_PROVIDER` | `tencent_agsx` 或 `local_piston` |
| `E2B_DOMAIN` / `E2B_API_KEY` | ______（用腾讯云沙箱时） |
| `K12_AGENT_PISTON_URL` | `http://127.0.0.1:2000` |

---

## 6. 在 IntelliJ IDEA 中配置并启动（推荐日常开发）

### 6.1 导入工程

1. Open → 选择仓库根目录或 `backend/`（Maven 多模块）。  
2. 确认 Project SDK = **JDK 17**。  
3. Maven 刷新，等待依赖下载完成。

### 6.2 为每个服务建 Run Configuration

![11111111](C:\Users\Lenovo\Desktop\11111111.png)

分别找到并「Run」主类（或右键 → Modify Run Configuration）：

| 服务 | 主类（大致包名） |
| --- | --- |
| Gateway | `...gateway.K12GatewayServiceApplication` |
| IAM | `...iam.K12IamServiceApplication` |
| Learning | `...learning.K12LearningServiceApplication` |
| Agent | `...agent.K12AgentServiceApplication` |
| Assessment | `...assessment.K12AssessmentServiceApplication` |

对每个 Configuration：

1. **Environment variables** 中按第 5 节粘贴该服务需要的变量（`KEY=value`，多行用 `;` 分隔，或 IDEA 的表格编辑）。  
2. Working directory 一般为对应模块目录或 `backend`。  
3. 不要把含真实密钥的 Run Configuration 导出进 Git（`.idea` 中的密钥配置请自行忽略）。
4. 真实填入请你删掉换行符；

**IAM 最低必填示例（值请替换）：**

```text
K12_COURSE_MEDIA_ENABLED=true;
K12_MINIO_ACCESS_KEY=admin;
K12_MINIO_BUCKET=k12-user-avatars;
K12_MINIO_ENDPOINT=http://122.51.54.52:9000;
K12_MINIO_SECRET_KEY=1022260464
```

**Learning 最低必填示例：**

```text
K12_AGENT_INTERNAL_API_KEY=change_me_for_local_development;
K12_COURSE_MEDIA_ENABLED=true;
K12_MINIO_ACCESS_KEY=admin;
K12_MINIO_BUCKET=k12-agent-artifacts;
K12_MINIO_ENDPOINT=http://122.51.54.52:9000;
K12_MINIO_SECRET_KEY=1022260464;
K12_NEO4J_DATABASE=neo4j;
K12_NEO4J_ENABLED=true;
K12_NEO4J_PASSWORD=1022260464;
K12_NEO4J_SEED_ON_STARTUP=true;
K12_NEO4J_URI=bolt://122.51.54.52:7687;
K12_NEO4J_USERNAME=neo4j;K12_REDIS_ENABLED=true;
K12_REDIS_HOST=122.51.54.52;
K12_REDIS_PASSWORD=1022260464;
K12_REDIS_PORT=6379
```

**Agent Service 最低必填示例：**

```text
K12_AGENT_CODE_QUOTA_ENABLED=true;
K12_AGENT_INTERNAL_API_KEY=change_me_for_local_development;
K12_AGENT_RABBITMQ_ENABLED=true;
K12_RABBITMQ_PASSWORD=1022260464
```

Gateway / Assessment同理，补齐 DB（Assessment）与 JWT / 下游 URI。

Assessment最低必填示例：

### 6.3 IDEA 启动顺序建议

1. **先起 RabbitMQ**（`deploy/rabbitmq`，必选）  
2. 起 Python：**Runtime + Worker**（见 6.4）  
3. 再起 IAM、Learning、Assessment  
4. 再起 Agent（依赖 Runtime / Worker / RabbitMQ 与 Feign 下游）  
5. 最后起 Gateway 与前端  

可用 IDEA Compound Configuration 一键起多个 Java 服务；Python 两个 Run 需单独配置。

### 6.4 IDEA 中的 Python 两个启动（Runtime + Worker）

Python 侧是**两个独立进程**，请在 IDEA 各建一个 Run / Debug Configuration（模块目录均为 `ai-services/k12-agent-runtime`，解释器使用该目录下 uv/venv 的 Python 3.13）。

| 配置名（建议） | 作用 | 启动方式示例 | Environment variables（IDEA 一栏粘贴） |
| --- | --- | --- | --- |
| **k12-agent-runtime** | HTTP 服务 :8090，同步对话 / 内部 API | Module / Script：`uv run k12-agent-runtime`，或入口 `k12_agent_runtime.main` | `PYTHONUNBUFFERED=1;HF_HUB_OFFLINE=1;TRANSFORMERS_OFFLINE=1` |
| **k12-agent-worker** | 消费 RabbitMQ 异步任务 | `uv run k12-agent-worker` | `PYTHONUNBUFFERED=1` |

说明：

- `PYTHONUNBUFFERED=1`：日志立即刷出，便于 IDEA 控制台看输出。  
- `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1`：Runtime 侧禁止联网拉 Hugging Face 模型（使用本地已缓存权重时）；Worker 一般不需要这两项。  
- **必须先部署并启动 RabbitMQ**，再启动 Worker；否则 Worker 连不上队列。  
- LLM Key、`K12_AGENT_INTERNAL_API_KEY`、`K12_AGENT_RABBITMQ_*` 等仍写在项目 `.env`（见 5.7），与 IDEA Environment 互补；同名时进程环境变量优先于 `.env`。  
- 日常联调：**两个 Python 配置都要启动**，不能只起其中一个替代另一个。

---

## 7. 不用 IDEA 的启动方式

### 7.1 Maven 命令行（Windows PowerShell）

先在**当前终端会话**设置环境变量（示例，请改成你的值）：

```powershell
$env:K12_AUTH_DB_HOST = "______"
$env:K12_AUTH_DB_PASSWORD = "______"
$env:K12_BUSINESS_DB_HOST = "______"
$env:K12_BUSINESS_DB_PASSWORD = "______"
$env:K12_JWT_SECRET = "______"
$env:K12_AGENT_RUNTIME_URL = "http://127.0.0.1:8090"
$env:K12_AGENT_INTERNAL_API_KEY = "______"
# …其余按第 5 节按需追加

cd D:\CodeWorkPlace\k12\backend
mvn clean package -DskipTests

# 每个服务开一个终端（或后台任务）
mvn -pl k12-iam-service -am spring-boot:run
mvn -pl k12-learning-service -am spring-boot:run
mvn -pl k12-assessment-service -am spring-boot:run
mvn -pl k12-agent-service -am spring-boot:run
mvn -pl k12-gateway-service -am spring-boot:run
```

> PowerShell 的 `$env:VAR` 只对**当前窗口**有效；五个服务需要五个窗口，或写成脚本统一 `Start-Process`。

### 7.2 打包后用 jar 运行（接近部署机）

```powershell
cd D:\CodeWorkPlace\k12\backend
mvn -pl k12-iam-service -am package -DskipTests
java -jar k12-iam-service\target\k12-iam-service-*.jar
# 其他服务同理；环境变量用系统环境或启动脚本注入
```

Linux/macOS 可用 `export K12_AUTH_DB_HOST=...` 再 `java -jar ...`。

### 7.3 系统环境变量 / 用户环境变量

把第 5 节变量写入 Windows「系统属性 → 环境变量」或 Linux `/etc/environment`、systemd `Environment=`，则 IDEA 与命令行都会继承，无需每个 Run Configuration 重复粘贴。仍建议敏感项只放本机，不写进仓库。

### 7.4 Python Runtime + Worker（命令行，等价于 IDEA 两个配置）

**先确认 RabbitMQ 已 `docker compose up -d`。**

```powershell
cd D:\CodeWorkPlace\k12\ai-services\k12-agent-runtime
# 已配置 .env，且 K12_AGENT_RABBITMQ_ENABLED=true
uv sync

# 终端一：HTTP Runtime（对应 IDEA runtime 环境变量）
$env:PYTHONUNBUFFERED = "1"
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
uv run k12-agent-runtime

# 终端二：Worker（对应 IDEA worker 环境变量；必须已起 RabbitMQ）
$env:PYTHONUNBUFFERED = "1"
uv run k12-agent-worker
```
### 7.5 前端

```powershell
cd D:\CodeWorkPlace\k12\qianduan
pnpm install
pnpm dev:user    # http://localhost:5173
pnpm dev:admin   # http://localhost:5174
```

Vite 已把 `/api` 代理到 `http://localhost:8080`，**无需**配置 `VITE_*`。生产构建：

```powershell
pnpm build
# 产物在各 app 的 dist/，由 Nginx 等托管，并把 /api 反代到 Gateway
```

### 7.6 Nacos（可选）

默认关闭。启用时：

```text
NACOS_DISCOVERY_ENABLED=true
NACOS_CONFIG_ENABLED=true
NACOS_SERVER_ADDR=127.0.0.1:8848
```

本地无 Nacos 时保持 `false`，否则可能影响启动。

---

## 8. 最小联调组合（按目标裁剪）

| 目标 | 最少启动 |
| --- | --- |
| 仅登录 / 用户管理 | MySQL + IAM + Gateway + admin-app |
| 课程选课与进度 | 上表 + Learning + user-app |
| 作业布置与提交 | 上表 + Assessment |
| AI 教学助教对话 | 上表 + **RabbitMQ** + Agent + Runtime + **Worker**（含 LLM Key） |
| 编程实验 / 沙箱 | 上表 + Runtime 沙箱（腾讯云或 Piston）+ **RabbitMQ + Worker** |
| 头像 / 封面 / 附件 | 打开 MinIO 相关开关并保证密钥正确 |
| 知识图谱力导向图 | Learning + Neo4j |
| 排行榜缓存 | Learning + Redis（可选） |

---

## 9. 常见问题

| 现象 | 排查 |
| --- | --- |
| 前端 502 / 连不上 API | Gateway 是否在 8080；Vite 代理是否指向 Gateway |
| 登录 401 | 账号是否存在；密码是否为创建时设置；非 DB 账号 `k12` |
| Agent 前端 503、日志 Java→Python 401 | `K12_AGENT_INTERNAL_API_KEY` 两边不一致 |
| Worker 起不来 / 异步无结果 | **RabbitMQ 是否已部署**；`.env` 与 Java `K12_RABBITMQ_*` 是否一致 |
| 头像 / 上传 503 | `K12_COURSE_MEDIA_ENABLED` 未开，或 MinIO 不可达 / 密钥错误 |
| JWT 校验失败跨服务 | 各服务 `K12_JWT_SECRET` / `ISSUER` 不一致 |
| 权限接口突然 403 | 执行了权限升级 SQL 但未重新登录 |
| Neo4j 相关接口空 / 失败 | `K12_NEO4J_ENABLED` 与连接信息 |
| 长章节保存失败 | `max_allowed_packet` 过小 |

---

## 10. 填写备忘（可打印）

```text
部署日期：______
负责人：______
MySQL 主机：______
Redis：开 / 关　主机：______
MinIO：开 / 关　Endpoint：______　课程桶：______　头像桶：______
Neo4j：开 / 关　URI：______
Runtime LLM：已配 / 未配
沙箱：腾讯云 / Piston / 关
RabbitMQ：已部署（必选）　Worker：已开 / 未开
Python IDEA env：Runtime=`PYTHONUNBUFFERED=1;HF_HUB_OFFLINE=1;TRANSFORMERS_OFFLINE=1`　Worker=`PYTHONUNBUFFERED=1`
管理员登录名：______（密码勿写在此文件入库）
学生演示账号：______
教师演示账号：______
```

填写完成后，可按 [演示文档](./demo-guide.md) 走全流程验收。
