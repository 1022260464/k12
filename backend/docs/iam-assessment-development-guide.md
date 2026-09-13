# IAM 账号安全与 Assessment 作业闭环说明

## 1. 本次实现范围

IAM 已实现：

- 连续登录失败计数，默认 5 次后临时锁定 15 分钟。
- 用户修改自己的密码、管理员重置用户密码。
- 管理员启用、禁用、锁定账号。
- 密码、账号状态、用户角色、角色权限变化后，旧 JWT 失效。
- 登录成功/失败审计和管理员敏感操作审计。
- 业务服务通过 IAM 远程校验 token-state；IAM 自己直接查数据库。

Assessment 已实现：

- 作业 `DRAFT -> PUBLISHED -> CLOSED` 生命周期和分页可见范围。
- 单选、多选、判断、简答题，以及题目选项和标准答案。
- 结构化逐题提交；题目存在时不允许只提交旧版文本答案。
- 客观题确定性自动判分；简答题进入 `PENDING_REVIEW`。
- 教师逐题评分、乐观版本校验、总分汇总和批改历史。
- Java/Python AI 批改消息协议；AI 结果只能作为建议，不能直接成为最终成绩。

## 2. 数据库升级

先在数据库软件中分别选择对应数据库，执行：

```text
backend/sql/mysql/k12_auth_security_upgrade.sql
backend/sql/mysql/k12_business_assessment_question_upgrade.sql
```

执行后检查：

```sql
USE k12_auth;
SHOW COLUMNS FROM sys_user LIKE 'auth_version';
SHOW TABLES LIKE 'sys_login_audit';
SHOW TABLES LIKE 'sys_operation_audit';

USE k12_business;
SHOW TABLES LIKE 'assessment_homework_question';
SHOW TABLES LIKE 'assessment_question_option';
SHOW TABLES LIKE 'assessment_submission_answer';
```

升级完成后必须重启 IAM、Learning、Agent、Assessment 和 Gateway。升级前签发的 JWT
没有 `authVersion`，会被主动拒绝，这是预期行为，需要重新登录。

## 3. JWT 立即失效流程

```text
登录 -> IAM 查询 sys_user.auth_version -> 写入 JWT authVersion
请求 -> JWT 验签/过期校验 -> token-state 校验 -> Controller -> Service

修改密码/状态/角色/角色权限
  -> 数据库 auth_version + 1
  -> 旧 JWT 中版本与数据库不一致
  -> IAM 返回 401，前端清除令牌并重新登录
```

业务服务使用 `K12RemoteTokenStateValidator` 调用 IAM 内网地址。IAM 不远程调用自己，
而由 `IamTokenStateValidator` 直接查询 `k12_auth.sys_user`。IAM 不可用时业务服务返回
503，采用安全优先的 fail-closed 策略。

本方案适合当前比赛和团队开发规模。高并发生产阶段可把 token 版本放入 Redis，并通过
数据库事务消息同步，减少每次请求查询 IAM 的成本。

## 4. IAM 新增接口

```text
PUT /api/v1/iam/users/me/password
PUT /api/v1/iam/users/{id}/password
PUT /api/v1/iam/users/{id}/status
GET /api/v1/iam/audits/logins?page=1&size=20
GET /api/v1/iam/audits/operations?page=1&size=20
```

修改自己的密码：

```json
{
  "currentPassword": "旧密码",
  "newPassword": "新密码至少8位"
}
```

更新状态：

```json
{
  "status": "DISABLED"
}
```

状态只允许 `ENABLED`、`DISABLED`、`LOCKED`。管理员不能修改自己当前登录账号的状态，
防止误操作导致系统失去可用管理员。

## 5. Assessment 新增接口

```text
GET    /api/v1/assessments/homeworks/{id}/questions
POST   /api/v1/assessments/homeworks/{id}/questions
PUT    /api/v1/assessments/homeworks/{id}/questions/{questionId}
DELETE /api/v1/assessments/homeworks/{id}/questions/{questionId}

GET /api/v1/assessments/homeworks/{id}/submissions/me/detail
GET /api/v1/assessments/homeworks/{id}/submissions/{studentId}/detail
PUT /api/v1/assessments/homeworks/{id}/submissions/{studentId}/answers/{questionId}/grade
```

题目只能在草稿状态修改。选择题选项 key 必须唯一；单选只能有一个标准答案；判断题
答案只能为 `TRUE` 或 `FALSE`；简答题必须填写参考答案。单份作业题目总分不能超过 100。

结构化提交示例：

```json
{
  "answerContent": "可选的整份备注",
  "answers": [
    {"questionId": 1, "selectedAnswers": ["B"], "answerText": null},
    {"questionId": 2, "selectedAnswers": [], "answerText": "我的解题过程"}
  ]
}
```

逐题批改示例：

```json
{
  "score": 18.5,
  "feedback": "过程正确，最后一步缺少单位",
  "expectedSubmissionVersion": 0
}
```

## 6. AI 批改边界

协议类位于：

```text
k12-assessment-service/src/main/java/com/k12/platform/assessment/contract/AiGradingTaskMessage.java
k12-assessment-service/src/main/java/com/k12/platform/assessment/contract/AiGradingResultMessage.java
```

后续 RabbitMQ 发布任务时使用 `taskId` 做幂等键，Python 必须原样返回 `schemaVersion`、
`taskId` 和 `submissionId`。AI 只返回 `suggestedScore`、反馈、理由和置信度；Java 保存为
待复核建议，最终成绩仍由教师接口确认。不得在消息中放 JWT、数据库密码或 API Key。

## 7. 后续开发顺序

1. 先写数据库升级脚本和实体。
2. 单表 CRUD 使用 MyBatis-Plus，自定义查询写 Mapper XML。
3. Service 写事务、状态机、数据权限和并发控制。
4. Controller 只处理 HTTP 参数与响应。
5. 同步 Gateway 与 Servlet 两层路径权限。
6. 补单元测试和真实数据库集成测试。
7. 更新 OpenAPI JSON，重新导入 Apifox。
