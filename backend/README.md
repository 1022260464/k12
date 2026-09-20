# K12 Platform Backend

Java 业务完善进度与下一阶段范围见 [Java 业务完善清单](docs/java-business-roadmap.md)。
Agent 的取消、重试、超时与消息确认说明见 [Agent 联调文档](docs/agent-java-integration-guide.md)。

K12 多智能体教学平台后端初始化为 Maven 多模块工程。当前拆分以业务边界为主，先保持轻量 Spring Boot 服务形态，便于后续接入注册中心、配置中心、网关路由、数据库和消息队列。

## Modules

| Module | Port | Responsibility |
| --- | ---: | --- |
| `k12-common` | - | 公共响应模型、共享契约和轻量工具。 |
| `k12-gateway-service` | 8080 | 平台统一入口、路由聚合、跨服务访问控制预留。 |
| `k12-iam-service` | 8081 | 学生、教师、家长、管理员等账号身份与权限域。 |
| `k12-learning-service` | 8082 | 课程、班级、知识点、学习任务等核心教学资源域。 |
| `k12-agent-service` | 8083 | 多智能体教学编排、对话上下文、工具调用和教学策略域。 |
| `k12-assessment-service` | 8084 | 作业、测验、诊断报告、学习效果评价和错题归因域。 |

## Microservice dependencies

父工程 `pom.xml` 统一管理 Spring Boot、Spring Cloud、Spring Cloud Alibaba 版本：

| Dependency BOM | Version |
| --- | --- |
| `spring-boot-dependencies` | `3.3.5` |
| `spring-cloud-dependencies` | `2023.0.3` |
| `spring-cloud-alibaba-dependencies` | `2023.0.3.4` |
| `mybatis-spring-boot-starter` | `3.0.5` |
| `mybatis-plus-spring-boot3-starter` | `3.5.17` |

各业务服务已接入 Spring Cloud Alibaba Nacos Discovery / Config，默认通过环境变量关闭，避免本地未启动 Nacos 时影响服务启动。

```bash
# 启用 Nacos 注册发现和配置中心
set NACOS_DISCOVERY_ENABLED=true
set NACOS_CONFIG_ENABLED=true
set NACOS_SERVER_ADDR=127.0.0.1:8848
```

服务间调用预留 Spring Cloud OpenFeign，负载均衡使用 Spring Cloud LoadBalancer。网关模块使用 Spring Cloud Gateway 作为后续统一入口基础。

## Data access

数据库访问依赖统一在父工程 `backend/pom.xml` 管理版本。各业务服务只声明自己需要的依赖，不在子模块里写版本号。

当前规则：

- `k12-gateway-service` 是 WebFlux 网关，只做路由、鉴权入口和跨服务转发，不接 MyBatis/MySQL。
- `k12-iam-service` 使用 `k12_auth` 权限库，已接入 JDBC、MySQL Driver、MyBatis-Plus。
- `k12-learning-service`、`k12-agent-service`、`k12-assessment-service` 使用 `k12_business` 业务库，已接入 JDBC、MySQL Driver、MyBatis-Plus。
- MyBatis-Plus Boot3 starter 已包含 MyBatis 核心能力；父工程同时管理 MyBatis 官方 starter 版本，后续如果某个模块只想用纯 MyBatis，可以直接声明 `mybatis-spring-boot-starter`。
- 同一个服务里不要同时直接引入 MyBatis 官方 starter 和 MyBatis-Plus starter，避免重复自动配置。默认优先用 MyBatis-Plus。

业务库初始化脚本位于：

```text
backend/sql/mysql/k12_business_init.sql
```

全新环境执行初始化脚本后会创建课程、智能体配置、Agent 运行记录、Agent
产物、作业、作业接收人、提交记录和批改历史表。已经存在 `k12_business` 的环境不要依赖
`CREATE TABLE IF NOT EXISTS` 更新旧表，应执行幂等升级脚本：

```text
backend/sql/mysql/k12_business_agent_upgrade.sql
backend/sql/mysql/k12_business_homework_workflow_upgrade.sql
```

该脚本会完成以下操作：

- 为 `agent_config` 增加唯一 `code`、配置版本和非敏感 JSON 配置。
- 创建 `agent_run`，记录输入、输出、状态、错误和执行耗时。
- 创建 `agent_artifact`，记录图表、表格和 MinIO 文件地址。
- 写入与 Python Runtime 对应的 `study-plan`、`demo-chart` 测试配置。

`agent_run.user_id` 只是对 `k12_auth.sys_user.id` 的逻辑引用，不建立跨库外键。
密钥、令牌和模型 API Key 不允许写入 `config_json`，应通过环境变量或配置中心管理。

默认业务库连接配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://${K12_BUSINESS_DB_HOST:127.0.0.1}:${K12_BUSINESS_DB_PORT:3306}/${K12_BUSINESS_DB_NAME:k12_business}
    username: ${K12_BUSINESS_DB_USERNAME:k12}
    password: ${K12_BUSINESS_DB_PASSWORD:}
```

执行脚本需要使用有建库和授权权限的 MySQL 账号，例如 root：

```bash
mysql -h <数据库主机> -P 3306 -u root -p < backend/sql/mysql/k12_business_init.sql
```

初始化脚本不会创建或重置应用账号密码。首次部署先在数据库管理软件中执行：

```sql
CREATE USER IF NOT EXISTS 'k12'@'%' IDENTIFIED BY '<强随机密码>';
ALTER USER 'k12'@'%' IDENTIFIED BY '<强随机密码>';
```

然后执行初始化脚本完成数据库、表和授权。生产环境应将 `%` 改为应用服务器的内网地址。

## Security

后端已统一接入 Spring Security + JWT。通用依赖放在父工程 `backend/pom.xml`，Servlet 服务的默认安全配置放在 `k12-common` 并通过 Spring Boot AutoConfiguration 自动生效；`k12-gateway-service` 使用 Spring Cloud Gateway，对应 WebFlux Security 配置保留在网关模块内。

默认规则：

- 放行健康检查、`/api/v1/iam/auth/login` 和 `/api/v1/iam/auth/register`。
- 其他接口默认需要 `Authorization: Bearer <token>`。
- 用户和角色管理接口仅允许 `ROLE_ADMIN` 访问。

```yaml
k12:
  security:
    jwt:
      issuer: ${K12_JWT_ISSUER:k12-platform}
      secret: ${K12_JWT_SECRET:k12-platform-dev-secret-change-me-2026-very-long-key}
      access-token-ttl: ${K12_JWT_ACCESS_TOKEN_TTL:30m}
```

生产环境必须通过环境变量替换默认开发密钥，并保证 Gateway、IAM 和所有业务服务使用相同密钥。

已有 `k12_auth` 数据库需要执行权限升级脚本：

```text
backend/sql/mysql/k12_auth_permission_upgrade.sql
```

它会幂等补齐用户、角色、课程、智能体和作业功能权限，包括独立的
`agent:invoke`、`homework:submit`、`homework:grade` 和学习档案权限，并写入管理员、教师、学生默认授权。执行后必须重新登录，
新的权限才会写入 JWT。

已有数据库的推荐升级顺序：

```text
1. 备份 k12_business 和 k12_auth
2. 使用具备 ALTER/CREATE 权限的管理账号执行 backend/sql/mysql/k12_business_agent_upgrade.sql
3. 使用管理账号执行 backend/sql/mysql/k12_business_homework_workflow_upgrade.sql
4. 使用管理账号执行 backend/sql/mysql/k12_auth_permission_upgrade.sql
5. 使用管理账号执行 backend/sql/mysql/k12_auth_learning_profile_upgrade.sql
6. 重启 IAM、Assessment、Agent Service 和 Gateway
7. 重新登录，获取包含新权限的 JWT
```

如果数据库报告`Packet for query is too large (... > 2,048)`，不是SQL语法错误，而是服务器
把`max_allowed_packet`错误设成了2KB。使用MySQL管理员账号执行
[`mysql_server_packet_fix.sql`](sql/mysql/mysql_server_packet_fix.sql)，断开并新建连接后执行
[`mysql_server_packet_verify.sql`](sql/mysql/mysql_server_packet_verify.sql)，确认全局值和会话值均为
`67108864`。只补Agent会话索引时，先执行
[`k12_business_agent_session_index_check.sql`](sql/mysql/k12_business_agent_session_index_check.sql)；
检查结果为空才执行
[`k12_business_agent_session_index_upgrade.sql`](sql/mysql/k12_business_agent_session_index_upgrade.sql)。
数据库软件中请使用“执行当前语句”，不要将这些文件合并后批量执行。

后续新增业务接口时，按以下安全规范同步 Gateway、Service 注解、权限数据和数据范围：

```text
backend/docs/security-development-guide.md
```

认证请求链路：

```text
React -> Gateway:8080 -> IAM:8081 登录并签发 JWT
React -> Gateway 校验 JWT -> 业务服务再次校验 JWT -> Controller
```

主要接口：

```text
POST /api/v1/iam/auth/login
POST /api/v1/iam/auth/register
GET  /api/v1/iam/me
GET/PUT /api/v1/iam/users/me/learning-profile
GET/POST/PUT/DELETE /api/v1/iam/users/**
GET  /api/v1/iam/roles
PUT  /api/v1/iam/roles/{id}/permissions
```

Gateway 默认将 IAM、Learning、Agent、Assessment 分别路由到本机 `8081`、`8082`、`8083`、`8084`，可通过 `K12_*_SERVICE_URI` 覆盖。

## IAM database

IAM 权限库使用独立 MySQL 数据库 `k12_auth`，不要和 Nacos 的 `nacos_config` 混用。初始化脚本位于：

```text
backend/sql/mysql/k12_auth_init.sql
```

默认连接配置：

```yaml
spring:
  datasource:
    url: jdbc:mysql://${K12_AUTH_DB_HOST:127.0.0.1}:${K12_AUTH_DB_PORT:3306}/${K12_AUTH_DB_NAME:k12_auth}
    username: ${K12_AUTH_DB_USERNAME:k12}
    password: ${K12_AUTH_DB_PASSWORD:}
```

仓库不保存数据库密码。PowerShell 启动服务前先设置环境变量：

```powershell
$env:K12_AUTH_DB_HOST = "<数据库主机>"
$env:K12_AUTH_DB_PASSWORD = "<权限库密码>"
$env:K12_BUSINESS_DB_HOST = "<数据库主机>"
$env:K12_BUSINESS_DB_PASSWORD = "<业务库密码>"
$env:K12_JWT_SECRET = "<至少 32 字节的随机密钥>"
```

公网连接 MySQL 时必须启用数据库 TLS，或者只允许应用通过服务器内网访问数据库。

执行脚本需要使用有建库和授权权限的 MySQL 账号，例如 root：

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p < backend/sql/mysql/k12_auth_init.sql
```

`k12-iam-service` 登录时会读取 `sys_user.password_hash`、用户角色和权限，成功后签发 JWT。可用受保护接口验证：

下方 `admin / admin123` 是登录示例，不是后端内置账号。仅当此前创建 admin 时使用该密码才有效；
初始化 SQL 和课程升级脚本都不会自动创建或重置 admin。
教师、学生联调账号的创建请求见 [课程联调账号准备](docs/course-development-guide.md#准备登录账号)。

```bash
curl.exe -X POST http://localhost:8080/api/v1/iam/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

curl.exe http://localhost:8080/api/v1/iam/me ^
  -H "Authorization: Bearer <登录响应中的 accessToken>"
```

## Common commands

```bash
mvn clean package
mvn test
mvn -pl k12-iam-service,k12-assessment-service -am test
mvn -pl k12-agent-service -am spring-boot:run
node scripts/test-course-integration.mjs
node scripts/test-security-assessment-integration.mjs
```

两个 Node.js 脚本会通过 Gateway 发起真实 HTTP 请求，默认地址为
`http://127.0.0.1:8080`。使用其他端口时可先设置
`K12_TEST_BASE_URL`；管理员账号和密码可通过
`K12_TEST_ADMIN_USERNAME`、`K12_TEST_ADMIN_PASSWORD` 覆盖。脚本不会把密码或
JWT 写入报告，报告生成在 `target/integration-reports/`。

JUnit 5、Mockito、测试覆盖范围及中文运行说明见：

```text
backend/docs/unit-testing-guide.md
```

## API document

Apifox 可直接导入 OpenAPI 3.0 JSON：

```text
backend/openapi/k12-api-openapi.json
```

后续新增或修改接口必须遵守：

```text
backend/docs/api-development-guide.md
```

该规范包含 URL、请求响应、Controller/Service/Mapper 分层、事务、权限、数据范围、SQL、异常、OpenAPI、测试和提交检查清单。

统一响应格式：

```json
{
  "code": 200,
  "message": "ok",
  "data": {},
  "timestamp": "2026-08-12T12:00:00Z"
}
```

当前 CRUD 接口覆盖用户、课程、智能体、作业四类资源。

课程模块已补充教师归属、分页检索、章节管理、学生报名/退课与学习进度，
并增加 Service 数据权限、事务及数据库集成测试。
已有数据库需先执行 [课程升级脚本](sql/mysql/k12_business_learning_upgrade.sql)，再按需执行
[课程封面关联脚本](sql/mysql/k12_business_course_media_seed.sql)，最后重启 Learning。
分层说明、权限矩阵和 Apifox 操作步骤见 [课程业务开发与联调说明](docs/course-development-guide.md)。
各模块剩余工作见 [Java 业务完善进度](docs/java-business-roadmap.md)。

学习排行榜根据MySQL中的有效选课章节进度计算，MySQL始终是积分真相源；开启Redis后，
Redis Sorted Set只作为可丢弃、可重建的短时读取缓存。Redis故障时接口自动回退MySQL。

```text
GET /api/v1/learning/leaderboard?limit=20
```

Learning服务本地启用Redis所需环境变量：

```dotenv
K12_REDIS_ENABLED=true
K12_REDIS_HOST=<redis-host>
K12_REDIS_PORT=6379
K12_REDIS_USERNAME=
K12_REDIS_PASSWORD=<redis-password>
K12_LEADERBOARD_CACHE_TTL=60s
# 同时启用：MinIO 封面签名 URL、首页已发布课程推荐、知识图谱 overview 缓存
K12_MEDIA_URL_CACHE_TTL=10m
K12_PUBLISHED_COURSES_CACHE_TTL=5m
K12_KG_OVERVIEW_CACHE_TTL=10m
```

首页推荐接口：

```http
GET /api/v1/learning/courses/recommended?limit=8
```

密码只放在IDE运行配置、操作系统环境变量或后续Nacos密文配置中，不提交到仓库。

Learning服务读取MinIO课程封面时，需要配置以下环境变量。数据库保存的是稳定
`cover_object_key`，接口返回的 `coverUrl` 是短期签名地址；关闭或连接失败时课程接口仍可用，
前端自动显示本地默认插画。

```dotenv
K12_COURSE_MEDIA_ENABLED=true
K12_MINIO_ENDPOINT=http://127.0.0.1:9000
K12_MINIO_ACCESS_KEY=<minio-access-key>
K12_MINIO_SECRET_KEY=<minio-secret-key>
K12_MINIO_BUCKET=k12-agent-artifacts
K12_COURSE_MEDIA_URL_TTL=15m
```

Agent Java 服务已经提供同步和异步运行闭环：校验 `agent:invoke`、从 JWT 获取用户 ID；
短任务调用 FastAPI，长任务通过 RabbitMQ 交给 Python Worker；结果统一写入 `agent_run`、
`agent_artifact`。接口如下：

代码沙箱通过同一个公开接口支持同步和异步执行：

```text
POST /api/v1/agents/code-executions
```

该接口通过Gateway转发，需要`ROLE_ADMIN`或`agent:invoke`。`executionMode=SYNC`时Java会先写
`RUNNING`，等待Runtime返回后持久化结果；`executionMode=ASYNC`时先写`PENDING`并返回HTTP 202，
由Python Worker消费代码队列并回传结果。响应中的`runId`可直接用于运行详情接口。
`agentCode=code-tutor`仅用于运行记录分类，无需新增智能体配置记录，也不能从普通Agent重试接口重试。
按用户限制云沙箱调用次数时，先单独执行
`backend/sql/mysql/k12_business_code_execution_quota.sql`，再设置
`K12_AGENT_CODE_QUOTA_ENABLED=true`并重启 Agent Service；默认每位用户每天20次，可用
`K12_AGENT_CODE_DAILY_LIMIT`调整。超额返回429。完整计数规则见Agent Java联调说明。

编程实验代码教练使用独立 `agentCode=python-code-coach`（不走 teaching-assistant 图谱流程）。
现网补种：`backend/sql/mysql/k12_agent_python_code_coach.sql`，并重启 Agent Runtime。

```text
POST /api/v1/agents/{agentCode}/runs
GET  /api/v1/agents/runs?page=1&size=20
GET  /api/v1/agents/runs/{runId}
GET  /api/v1/agents/runs/{runId}/artifacts
```

Java 与 Python Runtime 的职责、配置、启动顺序和 Apifox 联调说明见：

```text
backend/docs/agent-java-integration-guide.md
```

作业模块已增加完整基础流程：教师创建草稿、设置学生接收人、发布、关闭，
学生提交，教师分页查看与批改，并保留基于版本号的批改历史。Assessment 设置
接收人时会通过 OpenFeign 调 IAM 校验账号确实是启用状态的学生，不跨库读取
`k12_auth`。本地默认 IAM 地址为 `http://localhost:8081`，可通过
`K12_IAM_SERVICE_URL` 覆盖。

IAM 账号安全与结构化作业题目/答题/逐题批改已补齐。已有数据库先执行：

```text
backend/sql/mysql/k12_auth_security_upgrade.sql
backend/sql/mysql/k12_business_assessment_question_upgrade.sql
```

接口、JWT 失效流程、数据库检查和 AI 批改协议见：

```text
backend/docs/iam-assessment-development-guide.md
```

- 用户 CRUD 已经使用 MyBatis-Plus `BaseMapper` 写入 `k12_auth.sys_user`，用户角色绑定写入 `sys_user_role`。
- IAM 登录认证通过 `security -> service -> mapper -> database` 分层读取 `sys_user`、`sys_role`、`sys_permission`。
- 课程、智能体、作业已经使用 MyBatis-Plus `BaseMapper`，数据写入 `k12_business`。

当前 CRUD 代码按统一分层组织：

```text
web        Controller，只处理 HTTP 入参、状态码和响应包装
service    业务编排层，后续业务规则写在这里
mapper     数据访问接口，业务模块优先使用 MyBatis-Plus BaseMapper
           复杂查询使用 MyBatis 自定义 SQL，统一放在 Mapper 层
security   只对接 Spring Security，不直接写 SQL
model      领域对象
dto        请求和响应 DTO
```

MyBatis XML 文件统一放在各服务的 `src/main/resources/mapper/` 下，例如：

```text
k12-iam-service/src/main/resources/mapper/iam/UserMapper.xml
```

XML 使用规则：

- 单表 CRUD 优先用 MyBatis-Plus `BaseMapper`，不写 XML。
- 多表关联、RBAC 查询、复杂动态 SQL 放到 XML。
- XML 的 `namespace` 必须和 Java Mapper 接口全限定名一致。
- XML 的 `id` 必须和 Java Mapper 方法名一致。

Java 数据对象写法规范见：

```text
backend/docs/java-data-object-guide.md
```

## Health endpoints

```text
GET http://localhost:8080/api/v1/gateway/health
GET http://localhost:8081/api/v1/iam/health
GET http://localhost:8082/api/v1/learning/health
GET http://localhost:8083/api/v1/agents/health
GET http://localhost:8084/api/v1/assessments/health
```
