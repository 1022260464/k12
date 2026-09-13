# K12 后端 JUnit 单元测试说明

## 1. 测试技术栈

父工程通过 `spring-boot-starter-test` 统一提供以下测试能力：

- JUnit Jupiter（JUnit 5）：组织和执行测试。
- Mockito：模拟 Mapper、Feign Client 等外部依赖。
- AssertJ：编写可读性更好的断言。
- Maven Surefire `3.2.5`：让 Maven 正确发现并运行 JUnit 5 测试。

子模块不需要重复添加 JUnit、Mockito 版本。测试代码统一放在：

```text
模块/src/test/java/与正式代码相同的包路径
```

## 2. 当前测试覆盖

### Agent Java 调用闭环

测试文件：

```text
k12-agent-service/src/test/java/com/k12/platform/agent/service/AgentRunServiceTest.java
k12-agent-service/src/test/java/com/k12/platform/agent/client/AgentRuntimeContractTest.java
k12-agent-service/src/test/java/com/k12/platform/agent/service/AgentServiceTest.java
```

覆盖内容：

- 调用 Python 时用户 ID 只能来自 JWT。
- 成功结果和图表产物会交给事务存储层保存。
- Python Runtime 不可用时保存失败记录并返回 503。
- 异步请求先保存 `PENDING`，再发布包含 JWT 用户 ID 的 RabbitMQ 消息。
- RabbitMQ 未启用时拒绝异步请求，不产生半成品任务。
- Python 异步结果转换、终态幂等和失败信息脱敏。
- 普通用户查询运行列表时自动增加自己的用户 ID 数据范围。
- 其他用户的运行记录对当前用户返回 404。
- Java DTO 可以反序列化 Python Runtime 的 camelCase JSON。
- 智能体配置创建时清理文本并设置默认启用状态。

### Learning 课程 CRUD

测试文件：

```text
k12-learning-service/src/test/java/com/k12/platform/learning/service/CourseServiceTest.java
```

覆盖内容：

- 创建课程时清理字段首尾空格并设置默认状态。
- 更新不存在的课程时返回空结果，由 Controller 转换为 404。

### IAM 学习档案

测试文件：

```text
k12-iam-service/src/test/java/com/k12/platform/iam/service/LearningProfileServiceTest.java
```

覆盖内容：

- 从 JWT 中读取当前用户 ID。
- 学段名称转为大写、教材名称去除首尾空格。
- 学习兴趣去重并序列化为 JSON。
- 学段和年级不匹配时拒绝写入。
- 学习档案不存在时返回 404。
- 已停用用户不能读取学习档案。

### IAM 学生账号校验

测试文件：

```text
k12-iam-service/src/test/java/com/k12/platform/iam/service/StudentDirectoryServiceTest.java
```

覆盖内容：

- 请求中的重复学生 ID 去重。
- 区分有效学生 ID 和无效用户 ID。
- 拒绝空列表和非正整数 ID。

### Assessment 作业闭环

测试文件：

```text
k12-assessment-service/src/test/java/com/k12/platform/assessment/service/HomeworkServiceTest.java
```

覆盖内容：

- 创建作业时强制使用 `DRAFT`，教师 ID 来自 JWT。
- IAM 返回无效学生时不修改接收人表。
- 接收人去重并整体替换。
- 没有接收人时不能发布作业。
- 草稿可以正确发布为 `PUBLISHED`。
- 非接收人不能提交作业。
- 学生提交时只能使用 JWT 中自己的用户 ID。
- 同一学生不能重复提交同一作业。
- 批改成功后版本号加一并写入批改历史。
- 乐观锁版本冲突时返回 409，且不写批改历史。
- 教师不能修改其他教师创建的作业。

## 3. 如何运行

在 `backend` 目录执行全部测试：

```powershell
mvn test
```

只运行 IAM、Learning、Agent 和 Assessment 模块，同时构建它们依赖的 `k12-common`：

```powershell
mvn -pl k12-iam-service,k12-learning-service,k12-agent-service,k12-assessment-service -am test
```

只运行一个测试类：

```powershell
mvn -pl k12-iam-service -Dtest=LearningProfileServiceTest test
mvn -pl k12-agent-service -Dtest=AgentRunServiceTest test
mvn -pl k12-assessment-service -Dtest=HomeworkServiceTest test
```

IDEA 中也可以打开测试类，点击类名或测试方法左侧的绿色运行按钮。

## 4. Mockito 在这里做什么

单元测试只验证一个 Service 的业务逻辑，因此不会连接真实 MySQL、Nacos 或 IAM 服务。

例如：

```java
when(homeworkMapper.countRecipients(homeworkId)).thenReturn(0L);
```

这句话表示：当 Service 查询接收人数时，让模拟 Mapper 返回 `0`。随后测试断言
Service 必须拒绝发布作业。这样可以准确验证业务分支，不依赖数据库当前有什么数据。

```java
verify(homeworkMapper, never()).updateById(any());
```

这句话表示：发生校验错误后，数据库更新方法一次也不能被调用。它不仅检查返回错误，
还检查错误情况下没有产生写操作。

## 5. 为什么测试中手动设置 JWT

正式请求经过 Spring Security 后，JWT 会被放进 `SecurityContextHolder`。Service 再通过
`K12SecurityContext.requireUserId()` 读取当前用户 ID。

单元测试没有启动 Web 服务，因此测试代码会创建一个仅在当前测试线程有效的 JWT，
模拟“教师 10”或“学生 20”已经登录。每条测试结束后必须清理：

```java
SecurityContextHolder.clearContext();
```

否则上一个测试的登录身份可能污染下一个测试。

## 6. 当前测试边界

测试包含 Service 单元测试、课程 H2 数据库集成测试和课程 MockMvc HTTP 契约测试，
不代表完整系统联调已经通过。`CourseLearningIntegrationTest` 使用真实 Spring 方法权限代理、
MyBatis-Plus、Mapper XML 和事务，覆盖重复报名、并发进度上报、历史课程归属和越权路径。
H2 仅为 Learning 模块的 test 依赖，生产环境仍连接 MySQL。
以下内容应在后续集成测试中覆盖：

- MyBatis XML 是否能在真实 MySQL 8 上正确执行。
- 数据库事务回滚、外键、唯一索引和乐观锁的真实并发行为。
- Gateway 路径权限规则以及 `@PreAuthorize` 代理是否返回正确的 401/403。
- Assessment 通过 OpenFeign 调 IAM 时的 JWT 转发。
- Agent Service 通过 OpenFeign 调 Python Runtime 时的真实网络、超时和内部密钥校验。
- 使用真实 HTTP 请求完成“教师发布、学生提交、教师批改”完整流程。

单元测试失败时，先看失败方法的中文名称，再看 `expected` 和 `actual`。不要为了让测试
通过而删除断言；应先确认是业务实现错误，还是需求已经发生变化并需要同步修改测试。
