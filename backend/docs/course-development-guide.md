# 课程业务开发与联调说明

## 1. 当前实现范围

本阶段完成 Java Learning 服务的基础学习闭环：

```text
教师创建课程 -> 维护章节 -> 学生报名 -> 阅读章节 -> 上报学习进度 -> 退出或继续学习
```

同时实现分页检索、教师数据归属、参数校验、事务、逻辑删除、重复请求处理与测试。
数据存入 MySQL 的 `k12_business`，不是 `k12_auth` 或 pgvector。
本阶段不涉及 Python 模型、RAG、视频上传、付费课程、班级排课或课程发布审核。

## 2. 分层与职责

以下路径相对于 `backend/k12-learning-service/src/main`。

| 层级 | 文件/对象 | 职责 |
| --- | --- | --- |
| HTTP 入口 | `java/com/k12/platform/learning/web/CourseController.java` | 课程 CRUD、分页入参及响应 |
| HTTP 入口 | `web/CourseChapterController.java` | 章节目录、详情和管理接口 |
| HTTP 入口 | `web/CourseStudyController.java` | 当前用户报名、退课与学习进度 |
| 业务层 | `service/CourseService.java` | 课程元数据、创建人归属、分页规则 |
| 业务层 | `service/CourseAccessService.java` | 统一存在性、归属和报名检查 |
| 业务层 | `service/CourseChapterService.java` | 章节归属、排序、数量限制和逻辑删除 |
| 业务层 | `service/CourseStudyService.java` | 报名状态、幂等操作和进度累计 |
| 数据访问 | `mapper/*Mapper.java` | 单表 CRUD 使用 MyBatis-Plus BaseMapper |
| 自定义 SQL | `resources/mapper/learning/CourseMapper.xml` | 参数绑定的检索 SQL、课程行锁查询 |
| 数据对象 | `model` / `dto` | 实体使用 Getter/Setter；请求和响应使用 record |
| 异常出口 | `web/LearningExceptionHandler.java` | 统一 400、403、404、409 等业务响应 |

表内 `web`、`service` 等缩写路径均在上述 Java 包下。Controller 不写 SQL，Mapper 不读取 JWT。
Service 读取当前身份并确定数据范围，Mapper 仅执行查询和持久化。

## 3. 先升级数据库

### 已有 k12_business 的团队环境

1. 先备份，确认连接的是目标环境，暂停 Learning 写入或在维护窗口操作。
2. 用具备 `ALTER/CREATE` 权限的数据库维护账号打开 SQL 编辑器。
3. 执行 `backend/sql/mysql/k12_business_learning_upgrade.sql` 的完整脚本。
4. 脚本末尾应返回三个新增表以及 `learning_course.teacher_id` 字段。
5. 重启 Learning 服务，再发起接口请求。

脚本包含 `USE k12_business`。其中 PREPARE 语句依赖当前会话变量，必须在同一个连接中顺序执行，
不要逐段切换连接。重复执行不会清空历史数据；表已存在的提示不代表建表失败。
MySQL DDL 会隐式提交，不能依赖事务回滚整份升级脚本。

如果服务器仍将 `max_allowed_packet` 设置为 2048 字节，较长章节正文仍可能写入失败。
可先执行 `SHOW VARIABLES LIKE 'max_allowed_packet';` 检查，请数据库管理员按请求体大小调整，
再让连接池重新建立连接。接口正文上限是 20000 字符，不能用 2 KB 数据包配置进行完整验收。

### 全新环境

执行已更新的 `backend/sql/mysql/k12_business_init.sql`。
它已经包含本阶段结构。旧环境仅重跑 `CREATE TABLE IF NOT EXISTS` 不会给现有表增加字段，
所以旧环境必须执行上述 upgrade 脚本。

| 表/字段 | 内容 |
| --- | --- |
| `learning_course.teacher_id` | 当前课程创建人 ID；历史课程允许 NULL |
| `learning_course_chapter` | 章节标题、纯文本正文、排序、逻辑删除标记 |
| `learning_course_enrollment` | 用户报名状态；课程与用户的组合唯一 |
| `learning_chapter_progress` | 报名记录下各章节进度；报名与章节的组合唯一 |

所有新增表在同一业务数据库内，关联课程/报名/章节使用外键。
`teacher_id` 和 `user_id` 引用 IAM 的业务身份，不设置跨库外键，不直接查询 IAM 用户表。
本阶段没有新增权限代码，沿用 `course:read/create/update/delete` 和学生/管理员角色。

历史课程不会自动划给第一个访问它的教师。`teacher_id=NULL` 的课程仅管理员可维护。
如需迁移历史归属，先核验课程 ID 与 IAM 教师账号，再由维护人员进行带精确 ID 条件的定向更新，
不得不带 WHERE 批量认领。当前没有开放“修改课程归属”的 API。

本次自动化测试没有连接或修改团队共享 MySQL。

## 4. 权限规则

网关已有 `/api/v1/learning/**` 路由，不需要为每个新接口逐条添加转发。
但路由转发不等于授权：网关和 common 的 Servlet 安全链都先匹配报名、退课、进度等具体路径，
再匹配课程 CRUD 通配规则，否则学生的 PUT 报名会被误当作 course:update 拦截。
全部课程业务接口都要求有效 JWT；健康检查仍遵循已有白名单。

| 操作 | 功能权限 | 数据范围 |
| --- | --- | --- |
| 课程列表/详情/检索 | `course:read` 或管理员 | 有效且未删除的课程 |
| 新建课程 | `course:create` 或管理员 | 创建人自动取当前 JWT 用户 ID |
| 修改课程 | `course:update` 或管理员 | 非管理员只能操作自己创建的课程 |
| 删除课程 | `course:delete` 或管理员 | 非管理员只能操作自己创建的课程 |
| 新增/修改/删除章节 | `course:update` 或管理员 | 非管理员只能操作自己创建的课程 |
| 目录/正文 | `course:read` 或管理员 | 创建人、管理员或 ACTIVE 报名用户 |
| 报名/退课/进度 | 学生角色且有 `course:read`，或管理员 | 只操作 JWT 对应的当前用户 |

管理员操作学习接口时，也是操作自己的学习记录，不是替任意学生操作。
教师仅有 `course:read` 不代表可以阅读另一名教师课程的正文。
功能权限由 Service 的 `@PreAuthorize` 校验，数据权限由 Service 进一步检查，不能只做前端隐藏按钮。
不要在请求体新增可自由传入的 `userId` 或 `teacherId`。

## 5. 接口清单

以下路径省略统一前缀 `/api/v1/learning/courses`。

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| GET | 空路径 | 原数组列表，最多最近更新的 100 门有效课程 |
| GET | `/page` | 分页检索 |
| POST | 空路径 | 创建课程 |
| GET/PUT/DELETE | `/{id}` | 课程详情、修改、逻辑删除 |
| GET/POST | `/{courseId}/chapters` | 目录、新增章节 |
| GET/PUT/DELETE | `/{courseId}/chapters/{chapterId}` | 章节正文、修改、逻辑删除 |
| GET/PUT/DELETE | `/{courseId}/enrollment` | 查询本人报名状态、报名、退课 |
| PUT | `/{courseId}/chapters/{chapterId}/progress` | 上报本人章节进度 |
| GET | `/{courseId}/progress` | 本人课程进度和章节明细 |

分页参数：`page=1`、`size=20`，size 最大 100；可传 `keyword`、`subject`、`gradeLevel`、`mine`。
`keyword` 是标题字面值包含查询，不将用户输入拼成 SQL。`mine=true` 表示自己创建的课程，不是“我的选课”。
返回 `page/size/hasNext/items`，当前不计算 total，避免每次额外执行 COUNT。
所有操作继续使用 `code/message/data/timestamp` 响应结构。创建课程/章节 HTTP 状态为 201，
成功响应体的 `code` 沿用项目约定 200；错误 HTTP 状态与响应体 code 一致。

## 6. Apifox 联调步骤

导入或更新 `backend/openapi/k12-api-openapi.json`，在“02-课程资源服务”目录下测试。
环境基础 URL 使用 `http://127.0.0.1:8080`，需要启动 IAM、Gateway、Learning。
本流程不需要启动 RabbitMQ 或 Python Worker。

### 准备登录账号

此前 README 使用的管理员登录示例为 `admin / admin123`。只有你之前创建 admin 时设置的密码
确实是 admin123，该组合才有效；若已修改，请使用实际密码。初始化 SQL 不会自动创建 admin，
本轮课程升级也不会创建或重置任何用户。数据库连接账号 k12 不是系统登录账号。

登录接口：`POST http://127.0.0.1:8080/api/v1/iam/auth/login`，鉴权选择“无需鉴权”，
请求体选择 JSON：

```json
{ "username": "admin", "password": "admin123" }
```

成功后复制响应里的 `data.accessToken`。若返回 401，不代表需要重跑课程升级脚本，
应核实已有 admin 账号、启用状态和原来设置的密码；不要将明文密码直接写进 password_hash。

教师、学生联调账号需要先创建。用管理员令牌调用 `POST /api/v1/iam/users`：

```json
{
  "username": "k12_teacher_demo",
  "password": "K12Teach@2026",
  "nickname": "联调教师",
  "roleCode": "ROLE_TEACHER"
}
```

然后再创建学生账号：

```json
{
  "username": "k12_student_demo",
  "password": "K12Study@2026",
  "nickname": "联调学生",
  "roleCode": "ROLE_STUDENT"
}
```

以上是本地联调用的示例凭证，不是已存在账号，也不要用于生产环境。创建返回 HTTP 201 后，
才可使用相应用户名和密码调用登录接口。若用户名已存在，应使用原密码或另选用户名，
重复创建不会重置密码。学生也可以从公开注册接口创建；教师必须通过管理员分配角色。

先用教师登录，再用学生登录，分别保留两份 accessToken。Apifox 鉴权选择 Bearer Token，
Token 输入框仅填令牌内容；若手写请求头，则填写 `Authorization: Bearer <accessToken>`。

### 第一步：教师创建课程

`POST /api/v1/learning/courses`

```json
{
  "title": "一次函数基础",
  "subject": "数学",
  "gradeLevel": "八年级",
  "description": "学习一次函数的定义和图像"
}
```

记录响应的 `data.id` 作为 courseId，确认 `data.teacherId` 是当前教师 ID。

### 第二步：教师新增章节

`POST /api/v1/learning/courses/{courseId}/chapters`

```json
{
  "title": "第一章：一次函数",
  "content": "函数 y = kx + b，其中 k 不为 0。",
  "sortOrder": 1
}
```

记录章节 `data.id` 为 chapterId。正文按纯文本处理，前端不得当作可信 HTML 直接渲染。
目录只包含标题和顺序，不携带正文，避免一次返回大量章节内容。

### 第三步：切换学生令牌报名

先 `GET /{courseId}/chapters`，未报名应得到 403。
再 `PUT /{courseId}/enrollment`，不需要请求体，返回 `status=ACTIVE`。
重复发送仍然成功，不会产生第二条报名记录。
随后查询章节目录和章节详情，应成功读取内容。

上述简写路径仍需拼上完整的课程前缀。

### 第四步：上报学习进度

`PUT /api/v1/learning/courses/{courseId}/chapters/{chapterId}/progress`

```json
{ "progressPercent": 60 }
```

再上报 30，返回仍为 60；上报 100 后此章节完成。
查询 `GET /api/v1/learning/courses/{courseId}/progress` 查看汇总。
把进度改为 101 应得到 400，把 chapterId 换成其他课程章节应得到 404。

### 第五步：退课及越权检查

`DELETE /api/v1/learning/courses/{courseId}/enrollment` 后再访问正文或进度，应得到 403。
重复退课成功，重新报名保留旧进度。
换另一名教师令牌修改该课程，应得到 403；用学生令牌新增章节同样应得到 403。
测试时不要一直用 admin，否则容易遗漏数据权限问题。

## 7. 事务、幂等与限制

- 写入先通过 `SELECT ... FOR UPDATE` 锁父课程行，再做报名/章节/进度检查，事务结束自动释放锁。
- 按同一顺序锁定，防止“校验时存在、写入时已删除”的并发窗口；报名与进度另有唯一键兜底。
- 当前同一门课程的写操作串行，不同课程可并行。这适合初期联调，不代表完成高并发容量验证。
- 高并发场景需要压测后细化报名行锁、原子 UPSERT 或进度合并，不能直接删除现有锁。
- 报名和退课幂等；新增课程/新增章节 POST 暂无请求幂等键，不应盲目自动重试。
- 章节最多 500 个有效记录，标题最多 128 字符，正文最多 20000 字符，排序范围 0 到 10000。
- 学习进度是客户端自主上报，不是可信考试成绩，不能直接用来发证或计费。
- 单章节进度取历史最大值；课程总进度按当前有效章节平均并向下取整，无章节时为 0。
- 新增章节可能使总进度下降；删除章节不再计入均值，但历史进度保留。
- 退课和重新报名不会重置学习历史，enrolledTime 表示首次报名时间。

## 8. 测试与待办

2026-09-13 的真实网关联调已完成 51 项检查，详见
[联调结果与修复记录](course-integration-result-2026-09-13.md)。

### 真实 HTTP 自动联调

已启动 IAM、Learning 和 Gateway 并完成数据库升级后，可在项目根目录执行：

```powershell
node backend/scripts/test-course-integration.mjs
```

需要本地 Node.js 20 或更高版本。默认访问 `http://127.0.0.1:8080`，管理员登录使用
上述示例 `admin / admin123`；实际配置可通过 `K12_TEST_BASE_URL`、`K12_TEST_ADMIN_USERNAME`、
`K12_TEST_ADMIN_PASSWORD` 环境变量覆盖。不要把实际密码写入脚本或提交到仓库。

该脚本会创建唯一命名的两名教师、两名学生、两门课程及章节，通过真实 HTTP 检查正向与越权流程。
结束时自动退课，逻辑删除本轮创建的课程和账号，不删除既有业务数据。报名、进度、软删除记录
仍作为历史保留在数据库中，因此只应在可接受测试数据的开发环境运行，不能当作无副作用的健康检查。

报告写入被 Git 忽略的 `backend/target/integration-reports/`，记录每步状态、耗时、测试资源 ID 和清理结果，
不保存密码和 JWT。出现失败会停止后续业务步骤并尝试清理；如请求超时，需结合服务端日志确认
是否已完成写入，不能仅根据客户端超时认定数据库未发生变化。当前单次等待上限为 65 秒，
不代表接口达到生产性能要求。`cleanup` 中有失败项时，应按报告中的精确资源 ID 检查。

### 离线自动化测试

在 `backend` 目录运行：

```powershell
mvn -pl k12-learning-service -am test
```

IDEA 可在 Maven 面板执行 Lifecycle/test，不要求系统 PATH 已安装 Maven。

- `CourseServiceTest`：文本清理、默认状态、创建人写入、缺失课程。
- `CourseLearningIntegrationTest`：真实 Spring 方法权限代理、MyBatis-Plus、Mapper XML、H2 数据库和事务；
  覆盖选课闭环、教师越权、学生隔离、跨课程伪造、逻辑删除、历史无归属课程、分页参数绑定、并发重复选课和乱序上报。
- `CourseControllerTest`：MockMvc 检查 JSON 校验、路径绑定、错误状态和统一响应，不替代 JWT 过滤器测试。
- `CourseServletSecurityTest`、Gateway 的 `CourseGatewaySecurityTest`：运行真实两套安全过滤链，
  覆盖学生学习操作、管理员、缺失角色/权限、章节管理权限及匿名拦截；仅模拟 JWT 解码。

H2 仅为 test 依赖，不改变生产 MySQL 配置。H2 MySQL 模式不能完全模拟 MySQL 的锁、字符集和 DDL。
还需在真实 MySQL 执行 upgrade 并重复执行验证，完成上述 Gateway/Apifox 三种角色验收。
发布审核、课程归属转移、已选课程列表、教师查看学生学习明细、视频学习可信度和资源上传仍是后续功能。

## 9. 联调发现的空闲连接失效

2026-09-13 的真实联调中，Learning 启动时连接成功，空闲约 10 分钟后出现
`Failed to validate connection` 与 `No operations allowed after connection closed`，
分页请求约 30 秒后返回 500。随后旧连接淘汰后请求成功，说明不能将它误判为密码或 SQL 语法错误。
现有日志不能确定究竟是 MySQL 超时还是中间网络回收连接，需要结合服务器和网络配置继续确认。

IAM 与 Learning 已加入 `spring.datasource.hikari` 开发环境连接保活配置：

| 配置 | 当前默认值 | 作用 |
| --- | --- | --- |
| `keepalive-time` | 60000 ms | 周期校验空闲连接 |
| `max-lifetime` | 300000 ms | 缩短连接使用寿命，在归还连接后回收 |
| `validation-timeout` | 2000 ms | 限制单个连接校验等待 |
| `connection-timeout` | 10000 ms | 限制从连接池获取连接的等待 |

环境变量分别为 `K12_DB_KEEPALIVE_MS`、`K12_DB_MAX_LIFETIME_MS`、`K12_DB_VALIDATION_TIMEOUT_MS`、
`K12_DB_CONNECTION_TIMEOUT_MS`。配置不会修改数据库账号密码或服务端参数；修改后需重启服务。
keepalive 必须小于 maxLifetime，validationTimeout 必须小于 connectionTimeout。
maxLifetime 还应短于实际数据库/网络的连接寿命限制，以上数值不能代替生产环境实测。
参见 [HikariCP 官方配置说明](https://github.com/brettwooldridge/HikariCP#configuration-knobs-baby)。

短流程成功不代表空闲场景修复已经验收。重启后还应空闲至少 10 分钟再请求登录和课程分页，
检查首个请求耗时、连接池日志与状态码；不要通过无限重试掩盖问题。
