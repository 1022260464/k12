# 01 / 07 模块升级与验收

## 交付范围

本次增加学生学习档案、作业学生名单、发布与关闭、提交、教师批改、改分历史、个人学习结果查询，并对作业原有 CRUD 增加归属与状态限制。公开注册仍固定创建学生，用户 CRUD 沿用现有实现。

这不是完整赛事作品的完成声明：前端作业页面、自动批改、知识点映射、课程选课关系以及智能体根据成绩调整推荐，仍需要对应模块对接。本次提供受当前用户权限保护的档案和学习结果接口，不开放匿名 AI 数据读取接口。

## 修改前存档

- 源码快照：D:/idea/k12-archives/20260908-165844/k12-source-before-01-07.zip
- Git 历史：同目录 k12-history.bundle
- 源码快照包括当时所有 Git 跟踪文件及未忽略的未跟踪文件，共 211 个文件；不包括 node_modules、target、被忽略的环境配置和数据库。
- 恢复时先在新目录解压、核对内容。不要直接覆盖当前目录，否则会覆盖此后新增的工作。

## 1. 先升级数据库

新环境先按 README 执行原有 k12_auth_init.sql、k12_business_init.sql。已有环境不要重新初始化，执行下面两份增量 SQL：

1. backend/sql/mysql/k12_homework_submission_upgrade.sql：作用于 k12_business，新增教师归属、学生名单、提交记录、批改历史。
2. backend/sql/mysql/k12_learning_profile_permission_upgrade.sql：作用于 k12_auth，新增学习档案与角色权限。

Navicat 中打开 SQL 文件，确认连接和目标库后运行。两个文件有明确的 USE 语句；若实际库名不同，需按环境调整。需要建表、修改表和更新权限表的数据库权限。脚本可以重复执行，不会删除原有业务数据。

本次只在独立临时 MySQL 验证过 SQL，没有执行到项目配置中的远程数据库。

### 旧作业处理

旧作业 teacher_user_id 保持 NULL，升级后只有管理员可管理。不要把历史作业批量分配给当前登录教师。

由管理员核对作业与实际教师后，用明确的作业 ID 定向更新归属；不要执行无 WHERE 的更新。新作业自动记录 JWT 中的创建人，接口不接受前端传入的教师身份。

旧的 PUBLISHED 作业没有学生名单，学生看不到它。没有任何提交的旧作业可由管理员在数据库定向恢复为 DRAFT，核对教师归属后，通过名单和发布接口重新发布；有提交记录的作业应保留原状并单独迁移对应名单。

## 2. 重启与登录

重新构建并启动 Gateway（8080）、IAM（8081）、Assessment（8084）。普通联调可在 IDEA 分别运行这些模块的 Application。其他模块按需要启动，本次接口不要求全部微服务都启动。

权限升级后教师、学生必须重新登录，旧 JWT 不会自动获得新权限。测试使用真实后端环境，如 http://localhost:8080，不是 Apifox 本地 Mock。

## 3. 设置学生学习档案

学生 Token 调用 PUT /api/v1/iam/users/me/learning-profile：

~~~json
{
  "schoolStage": "PRIMARY_UPPER",
  "grade": 5,
  "textbook": "人工智能通识",
  "interests": ["编程", "绘本"]
}
~~~

四个学段分别为 PRIMARY_LOWER（1～3）、PRIMARY_UPPER（4～6）、JUNIOR_HIGH（7～9）、SENIOR_HIGH（10～12）。教材暂存选择名称，后续与课程目录对接。兴趣最多 10 个、每个最长 40 字符。

调用同路径 GET 读取；未设置时为 404。userId 从 JWT 获取，不能修改其他学生，也不能通过此接口修改角色。档案选择本身不会自动改变 AI 的回答，需要智能体读取并使用这些字段。

## 4. 教师创建、分配、发布作业

下面 H 表示创建接口返回的真实作业 ID，S 表示 IAM 已有学生账号 ID；示例 3 不能直接当作你环境的学生 ID。

1. 教师 POST /api/v1/assessments/homeworks，提交 {"courseId":1,"title":"循环练习","description":"解释循环停止条件","status":"DRAFT"}，记录返回的 H。courseId 使用实际课程 ID。
2. 教师 PUT /api/v1/assessments/homeworks/H/recipients，提交 {"studentUserIds":[3]}，将 3 替换成 S；返回最终名单。
3. 教师 GET 同一 recipients 路径核对名单。
4. 教师 POST /api/v1/assessments/homeworks/H/publish，无需请求体，状态变为 PUBLISHED。
5. 学生 GET /api/v1/assessments/homeworks?page=1&size=20，仅能看到分配给自己的已发布/已关闭作业。

目前没有选课或班级关系，名单由有权管理该作业的教师/管理员提供。正数 ID 和人数会校验，但没有跨 IAM 校验账号是否存在、是否仍为学生，因此分配前必须从真实学生名册核对；后续应通过 IAM/课程服务提供受保护的校验与选课接口，不要直接跨服务读表。

原列表响应 data 仍是数组，但改为数据库分页，默认 20 条，最多 100 条。原 CRUD 的直接 PUBLISHED 创建、普通 PUT 改状态现在返回 409，客户端应按上述流程调整。

## 5. 学生提交

学生 POST /api/v1/assessments/homeworks/H/submit：

~~~json
{"answerContent":"每轮先判断循环条件，条件不成立时结束循环。"}
~~~

成功返回 HTTP 201、状态 SUBMITTED、version 0。身份来自学生 Token，答案最长 5000 字符。重复提交为 409；不在名单内为 404；草稿或关闭作业不允许提交。

未提交不创建空记录，个人提交查询为 404。当前不允许学生覆盖原答案，重交需要后续独立的版本设计。

## 6. 教师批改与学生反馈

1. 教师 GET /api/v1/assessments/homeworks/H/submissions?page=1&size=20，读取提交列表及 total。
2. 教师 POST /api/v1/assessments/homeworks/H/grade，提交 {"studentUserId":3,"score":92.5,"feedback":"思路正确，请补充边界条件。"}。
3. 返回 GRADED、version 1、gradedBy、成绩与反馈。分数为 0～100，最多两位小数，反馈最长 2000 字符。
4. 改分时先查询当前版本，再提交 {"studentUserId":3,"score":95,"feedback":"复核后调整","expectedVersion":1}。过期版本返回 409，不会覆盖新结果。
5. 教师 GET /api/v1/assessments/homeworks/H/submissions/S/grade-history，查看最近 100 个批改版本。
6. 学生 GET /api/v1/assessments/homeworks/H/submissions/me，查看自己的答案、状态、分数、反馈。
7. 教师 POST /api/v1/assessments/homeworks/H/close，停止接收新提交；已有提交仍可批改与查看。

有提交的作业不能删除，返回 409。教师功能权限之外还检查创建人，不允许另一位教师管理、批改或查看提交。管理员保留管理权限。提交、关闭、名单修改和删除在同一作业行上加锁，批改写分数和历史在同一事务内。

## 7. 对接智能体与学情

学生授权上下文可以 GET /api/v1/assessments/homeworks/learning-results/me?page=1&size=20，获得本人按提交 ID 倒序的结果，包含 courseId、homeworkId、成绩、反馈和 version。消费端筛选 GRADED，使用提交 ID 与 version 防止重复处理。

该接口同时可能返回 SUBMITTED 项，不能把 score=null 当成 0 分。列表不是增量事件流：改分不会把旧提交移到第一页，消费端需要复查相关提交或后续接入可靠变更事件。现在没有主动通知、知识点掌握度计算或自动推荐，不应在演示中声称这些已实现。

AI 读取时沿用当前学生的授权上下文；不得传任意 studentUserId 绕过权限，也不要把管理 Token 交给大模型。后续自动批改应将 AI 建议和教师最终成绩分别建模，外部模型请求放在数据库事务之外。

## 8. Apifox 导入

导入 backend/openapi/k12-api-01-07-apifox-openapi.json，选择现有默认模块，核对两个 tag 目录及按路径、方法匹配的更新预览。文件包含 01 模块 12 个、07 模块 15 个操作；只保留真实登录接口，不重复列出旧的登录条目。项目总文档 k12-api-openapi.json 也已同步新增接口。

共享项目导入会修改团队文档。不要为了导入本模块覆盖根目录的其他认证配置，测试时分别使用教师和学生环境变量保存 Token。

## 9. 自动化验证

仅运行不依赖数据库的测试：在 backend 执行 mvn test。真实数据库集成测试默认跳过，不能把跳过当成通过。

Windows 已安装 MySQL Server 8 和 Maven 时，在项目根目录运行：

~~~powershell
.\tools\test-api-01-07.ps1
# 找不到 Maven 或 MySQL 时：
.\tools\test-api-01-07.ps1 -MySqlHome "C:/Program Files/MySQL/MySQL Server 8.0" -MavenPath "D:/your-maven/bin/mvn.cmd"
~~~

脚本拒绝使用已占用的 33079 端口，在 tools/.cache 创建独立 MySQL，执行原始 SQL 和两次升级 SQL，运行全后端 clean test，最后停止临时实例。数据库测试还检查专用标记表，避免误连其他库。临时数据保留供排查；不会读取项目远程数据库密码。

测试覆盖：JWT claims 校验、登录、学生注册及 BCrypt、用户 CRUD、角色错误事务回滚、档案身份隔离与学段校验、网关路径权限、下游权限、作业真实 HTTP 提交批改反馈、并发重复提交、成绩版本冲突、历史插入失败回滚、关闭限制。

HTTP 测试使用 MockMvc/WebTestClient 和测试 JWT 解码器，SQL 使用真实 MySQL。它们验证分层逻辑和规则，不等同于已完成真实端口间的 JWT 签发与网关转发联调；共享环境部署后仍需按第 3～6 节走一遍真实 Token 流程。
